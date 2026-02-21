import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { Buffer } from 'node:buffer'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // 1. 인증 확인
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonError('인증이 필요합니다.', 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiKey = Deno.env.get('OPENAI_API_KEY')

    if (!openaiKey) {
      return jsonError('OpenAI API 키가 설정되지 않았습니다.', 500)
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey)
    const token = authHeader.replace('Bearer ', '')

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) {
      return jsonError('유효하지 않은 인증입니다.', 401)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 2. 요청 파싱
    const contentType = req.headers.get('content-type') || ''

    // 재분석 요청 (JSON)
    if (contentType.includes('application/json')) {
      const body = await req.json()
      if (body.reanalyze && body.file_id) {
        return await handleReanalyze(supabase, user.id, body.file_id, openaiKey)
      }
      return jsonError('잘못된 요청입니다.', 400)
    }

    // 신규 업로드 (FormData)
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const studentId = formData.get('student_id') as string

    if (!file || !studentId) {
      return jsonError('파일과 학생 ID는 필수입니다.', 400)
    }

    const { data: student, error: studentError } = await supabase
      .from('sm_students')
      .select('id, grade, enrollment_year')
      .eq('id', studentId)
      .eq('created_by', user.id)
      .maybeSingle()

    if (studentError || !student) {
      return jsonError('해당 학생에 대한 권한이 없습니다.', 403)
    }

    const fileName = file.name
    const ext = fileName.split('.').pop()?.toLowerCase()
    const ALLOWED_DOC = ['pdf', 'docx']
    const ALLOWED_IMG = ['jpg', 'jpeg', 'png', 'webp', 'gif']
    if (!ext || ![...ALLOWED_DOC, ...ALLOWED_IMG].includes(ext)) {
      return jsonError('PDF, DOCX, JPG, PNG 파일을 지원합니다.', 400)
    }
    if (file.size > 10 * 1024 * 1024) {
      return jsonError('파일 크기는 10MB 이하여야 합니다.', 400)
    }

    const isImage = ALLOWED_IMG.includes(ext)

    // 3. Storage 업로드 (물리 파일은 1번만)
    const uploadId = crypto.randomUUID()
    const storagePath = `${studentId}/${uploadId}.${ext}`
    const fileBuffer = await file.arrayBuffer()

    const { error: uploadError } = await supabase.storage
      .from('sm-activity-files')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return jsonError(`파일 업로드 실패: ${uploadError.message}`, 500)
    }

    // 4. 텍스트 추출 또는 이미지 처리
    let rawText = ''
    let entries: any[] = []

    if (isImage) {
      // 이미지: GPT Vision API로 직접 분석
      try {
        const base64 = bufferToBase64(new Uint8Array(fileBuffer))
        const mimeType = file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`
        entries = await extractEntriesFromImage(openaiKey, base64, mimeType, fileName, student.grade, student.enrollment_year)
        rawText = `[이미지 파일: ${fileName}]`
      } catch (aiError) {
        return jsonError(`이미지 AI 분석 실패: ${aiError}`, 500)
      }
    } else {
      // 문서: 텍스트 추출 후 분석
      try {
        if (ext === 'pdf') {
          rawText = await extractPdfText(new Uint8Array(fileBuffer))
        } else if (ext === 'docx') {
          rawText = await extractDocxText(new Uint8Array(fileBuffer))
        }
      } catch (parseError) {
        return jsonError(`텍스트 추출 실패: ${parseError}`, 500)
      }

      if (!rawText.trim()) {
        return jsonError('파일에서 텍스트를 추출할 수 없습니다.', 400)
      }

      // 5. AI 분석 - 모든 항목 개별 추출
      try {
        entries = await extractAllEntries(openaiKey, rawText, fileName, student.grade, student.enrollment_year)
      } catch (aiError) {
        return jsonError(`AI 분석 실패: ${aiError}`, 500)
      }
    }

    if (entries.length === 0) {
      return jsonError('문서에서 활동 항목을 추출할 수 없습니다.', 400)
    }

    // 6. 각 항목마다 DB 레코드 생성
    const createdFiles: any[] = []
    const createdAnalyses: any[] = []
    const savedRawText = rawText.substring(0, 50000)

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]

      // sm_uploaded_files 레코드 (각 항목마다 별도)
      const { data: fileRecord, error: insertError } = await supabase
        .from('sm_uploaded_files')
        .insert({
          student_id: studentId,
          uploaded_by: user.id,
          file_name: fileName,
          file_type: ext,
          file_size_bytes: file.size,
          storage_path: storagePath,
          semester: entry.semester || '',
          category_main: entry.category_main || '창체활동',
          changche_type: entry.changche_type || null,
          changche_sub: entry.changche_sub || '',
          gyogwa_type: entry.gyogwa_type || null,
          gyogwa_sub: entry.gyogwa_sub || '',
          gyogwa_subject_name: entry.gyogwa_subject_name || '',
          bongsa_hours: entry.bongsa_hours ?? null,
          analysis_status: '완료',
        })
        .select()
        .single()

      if (insertError || !fileRecord) continue

      // sm_file_analysis 레코드
      const { data: analysis } = await supabase
        .from('sm_file_analysis')
        .insert({
          file_id: fileRecord.id,
          student_id: studentId,
          title: entry.title || '',
          activity_content: entry.activity_content || '',
          conclusion: entry.conclusion || '',
          research_plan: entry.research_plan || '',
          reading_activities: entry.reading_activities || '',
          evaluation_competency: entry.evaluation_competency || '',
          raw_text: i === 0 ? savedRawText : '', // 원본 텍스트는 첫 레코드에만
        })
        .select()
        .single()

      createdFiles.push(fileRecord)
      if (analysis) createdAnalyses.push(analysis)
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: createdFiles.length,
        files: createdFiles,
        analyses: createdAnalyses,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return jsonError(`서버 오류: ${err}`, 500)
  }
})

// ============================================================
// 재분석 처리
// ============================================================
async function handleReanalyze(
  supabase: any,
  userId: string,
  fileId: string,
  openaiKey: string,
) {
  const { data: fileRecord, error: fileError } = await supabase
    .from('sm_uploaded_files')
    .select('*, sm_students!inner(grade, enrollment_year, created_by)')
    .eq('id', fileId)
    .single()

  if (fileError || !fileRecord) {
    return jsonError('파일을 찾을 수 없습니다.', 404)
  }
  if (fileRecord.sm_students.created_by !== userId) {
    return jsonError('해당 파일에 대한 권한이 없습니다.', 403)
  }

  const { data: existingAnalysis } = await supabase
    .from('sm_file_analysis')
    .select('raw_text')
    .eq('file_id', fileId)
    .maybeSingle()

  const rawText = existingAnalysis?.raw_text
  if (!rawText) {
    return jsonError('원본 텍스트가 없어 재분석할 수 없습니다.', 400)
  }

  // 개별 항목 재분석 (단건)
  let entries: any[]
  try {
    entries = await extractAllEntries(
      openaiKey, rawText, fileRecord.file_name,
      fileRecord.sm_students.grade, fileRecord.sm_students.enrollment_year,
    )
  } catch (aiError) {
    await supabase
      .from('sm_uploaded_files')
      .update({ analysis_status: '실패', analysis_error: `AI 재분석 실패: ${aiError}` })
      .eq('id', fileId)
    return jsonError(`AI 재분석 실패: ${aiError}`, 500)
  }

  // 기존 단건만 업데이트
  const entry = entries[0] || {}
  await supabase
    .from('sm_uploaded_files')
    .update({
      semester: entry.semester || '',
      category_main: entry.category_main || '창체활동',
      changche_type: entry.changche_type || null,
      changche_sub: entry.changche_sub || '',
      gyogwa_type: entry.gyogwa_type || null,
      gyogwa_sub: entry.gyogwa_sub || '',
      gyogwa_subject_name: entry.gyogwa_subject_name || '',
      bongsa_hours: entry.bongsa_hours ?? null,
      analysis_status: '완료',
      analysis_error: null,
    })
    .eq('id', fileId)

  const { data: analysis } = await supabase
    .from('sm_file_analysis')
    .upsert({
      file_id: fileId,
      student_id: fileRecord.student_id,
      title: entry.title || '',
      activity_content: entry.activity_content || '',
      conclusion: entry.conclusion || '',
      research_plan: entry.research_plan || '',
      reading_activities: entry.reading_activities || '',
      evaluation_competency: entry.evaluation_competency || '',
      raw_text: rawText,
      is_edited: false,
    }, { onConflict: 'file_id' })
    .select()
    .single()

  const { data: updatedFile } = await supabase
    .from('sm_uploaded_files')
    .select('*')
    .eq('id', fileId)
    .single()

  return new Response(
    JSON.stringify({ success: true, file: updatedFile, analysis }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// ============================================================
// 이미지 → base64 변환
// ============================================================

function bufferToBase64(buffer: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i])
  }
  return btoa(binary)
}

// ============================================================
// 이미지 파일 AI 분석 (GPT Vision)
// ============================================================

async function extractEntriesFromImage(
  apiKey: string,
  base64: string,
  mimeType: string,
  fileName: string,
  studentGrade: string | null,
  enrollmentYear: number | null,
): Promise<any[]> {
  const systemPrompt = buildSystemPrompt(studentGrade, enrollmentYear)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 16384,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: `파일: ${fileName}\n\n이 이미지에서 모든 활동 항목을 추출해주세요.` },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`OpenAI API 오류 (${response.status}): ${errorBody}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI 응답이 비어있습니다.')

  const finishReason = data.choices?.[0]?.finish_reason
  console.log(`[AI-Vision] finish_reason: ${finishReason}, content length: ${content.length}`)

  let parsed: any
  try {
    parsed = JSON.parse(content)
  } catch {
    console.log('[AI-Vision] JSON 파싱 실패, 복구 시도...')
    const recovered = recoverTruncatedJson(content)
    parsed = JSON.parse(recovered)
  }

  if (Array.isArray(parsed.e)) return parsed.e.map(expandEntry)
  if (Array.isArray(parsed.entries)) {
    return parsed.entries.map((entry: any) => {
      if (entry.semester || entry.category_main) return entry
      return expandEntry(entry)
    })
  }
  return [expandEntry(parsed)]
}

// ============================================================
// 텍스트 추출
// ============================================================

async function extractPdfText(buffer: Uint8Array): Promise<string> {
  const { default: pdfParse } = await import('npm:pdf-parse@1.1.1')
  const result = await pdfParse(Buffer.from(buffer))
  return result.text
}

async function extractDocxText(buffer: Uint8Array): Promise<string> {
  const { default: mammoth } = await import('npm:mammoth@1.8.0')
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
  return result.value
}

// ============================================================
// AI: 문서에서 모든 활동 항목을 개별 추출 (압축 형식)
// ============================================================

// 압축 키 → 실제 DB 필드명 매핑
const KEY_MAP: Record<string, string> = {
  s: 'semester',
  c: 'category_main',
  ct: 'changche_type',
  cs: 'changche_sub',
  gn: 'gyogwa_subject_name',
  gt: 'gyogwa_type',
  gs: 'gyogwa_sub',
  bh: 'bongsa_hours',
  t: 'title',
  ac: 'activity_content',
  cl: 'conclusion',
  rp: 'research_plan',
  ra: 'reading_activities',
  ec: 'evaluation_competency',
}

// 압축 값 → 실제 값 매핑
const VALUE_MAP: Record<string, Record<string, string>> = {
  category_main: { '창': '창체활동', '교': '교과세특' },
  changche_type: { '자': '자율활동', '동': '동아리활동', '진': '진로활동', '봉': '봉사활동' },
  gyogwa_type: { '수': '교과활동(수행)', '추': '추가활동' },
}

function expandEntry(compact: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [shortKey, value] of Object.entries(compact)) {
    const fullKey = KEY_MAP[shortKey] || shortKey
    // 값 매핑 확인
    if (VALUE_MAP[fullKey] && typeof value === 'string' && VALUE_MAP[fullKey][value]) {
      result[fullKey] = VALUE_MAP[fullKey][value]
    } else {
      result[fullKey] = value
    }
  }
  // 누락된 필드 기본값
  result.semester = result.semester || ''
  result.category_main = result.category_main || '창체활동'
  result.changche_type = result.changche_type || null
  result.changche_sub = result.changche_sub || ''
  result.gyogwa_subject_name = result.gyogwa_subject_name || ''
  result.gyogwa_type = result.gyogwa_type || null
  result.gyogwa_sub = result.gyogwa_sub || ''
  result.bongsa_hours = result.bongsa_hours ?? null
  result.title = result.title || ''
  result.activity_content = result.activity_content || ''
  result.conclusion = result.conclusion || ''
  result.research_plan = result.research_plan || ''
  result.reading_activities = result.reading_activities || ''
  result.evaluation_competency = result.evaluation_competency || ''
  return result
}

// 시스템 프롬프트 생성 (텍스트 분석 & 이미지 분석 공용)
function buildSystemPrompt(studentGrade: string | null, enrollmentYear: number | null): string {
  return `한국 고등학생 생활기록부(생기부) 문서에서 모든 활동 기록을 개별 항목으로 추출하세요.
학생 현재 ${studentGrade ? `${studentGrade}학년` : '학년 미상'}, 입학연도: ${enrollmentYear || '미상'}

## 핵심 규칙
- 문서의 **모든** 활동/교과 기록을 빠짐없이 각각 별도 항목으로 추출
- 1학년/2학년/3학년 자료 모두 포함. 학년별 기록을 절대 빠뜨리지 마세요!
- 창체활동(자율/동아리/진로/봉사)과 교과세특이 섞여 있을 수 있음
- 한 교과 안에서도 여러 활동(발표, 토론, 수행평가 등)이 있으면 각각 별도 항목으로 분리

## 압축 JSON 형식 (토큰 절약을 위해 반드시 짧은 키 사용!)

키 설명:
- s: 학기 ("1-1","1-2","2-1","2-2","3-1","3-2")
- c: 대분류 ("창"=창체활동, "교"=교과세특)
- ct: 창체유형 ("자"=자율, "동"=동아리, "진"=진로, "봉"=봉사). 교과세특이면 생략
- cs: 창체 활동명 (특강,실험,프로젝트 등). 교과세특이면 생략
- gn: 교과명 (국어,수학,영어,물리학1,화학1 등). 창체면 생략
- gt: 교과유형 ("수"=교과활동(수행), "추"=추가활동). 창체면 생략
- gs: 교과 활동명 (발표,토론,실험,보고서 등). 창체면 생략
- bh: 봉사시간 (숫자). 봉사 아니면 생략
- t: 제목/주제 (간결하게)
- ac: 구체적 내용 (핵심 위주)
- cl: 후속활동/소감 (없으면 생략)
- rp: 추가탐구계획 (없으면 생략)
- ra: 독서활동 (도서명/저자, 없으면 생략)
- ec: 평가역량 (탐구역량,성실성 등 쉼표구분)

## 중요: 빈 값인 필드는 반드시 생략! null도 생략! 이것이 토큰을 절약하는 핵심입니다.

## 응답 형식 (정확히 이 형식):
{"e":[{"s":"1-1","c":"창","ct":"자","cs":"특강","t":"유클리드 기하학","ac":"그뢰브너 기저 소감문 작성","ec":"탐구역량"},{"s":"1-1","c":"교","gn":"국어","gt":"수","gs":"토론","t":"의대 정원 토론","ac":"의과대학 정원 확대 찬성 입장 발표","ra":"언어의 높이뛰기/신지영","ec":"비판적사고"}]}

모든 학년(1학년,2학년,3학년)의 모든 항목을 빠짐없이 추출하세요.`
}

async function extractAllEntries(
  apiKey: string,
  text: string,
  fileName: string,
  studentGrade: string | null,
  enrollmentYear: number | null,
): Promise<any[]> {
  const inputText = text.substring(0, 60000)
  const systemPrompt = buildSystemPrompt(studentGrade, enrollmentYear)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 16384,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `파일: ${fileName}\n\n${inputText}` },
      ],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`OpenAI API 오류 (${response.status}): ${errorBody}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI 응답이 비어있습니다.')

  // finish_reason 확인 - 잘린 경우 로그
  const finishReason = data.choices?.[0]?.finish_reason
  console.log(`[AI] finish_reason: ${finishReason}, content length: ${content.length}`)

  let parsed: any
  try {
    parsed = JSON.parse(content)
  } catch {
    // JSON이 잘린 경우: 마지막 완전한 항목까지 복구 시도
    console.log('[AI] JSON 파싱 실패, 복구 시도...')
    const recovered = recoverTruncatedJson(content)
    parsed = JSON.parse(recovered)
  }

  // 압축 형식 (e 배열)
  if (Array.isArray(parsed.e)) {
    return parsed.e.map(expandEntry)
  }
  // 이전 형식 호환 (entries 배열)
  if (Array.isArray(parsed.entries)) {
    return parsed.entries.map((entry: any) => {
      // 이미 풀네임 키이면 그대로, 축약 키이면 확장
      if (entry.semester || entry.category_main) return entry
      return expandEntry(entry)
    })
  }
  // 이전 형식 호환 (단건)
  if (parsed.classification && parsed.analysis) {
    return [{ ...parsed.classification, ...parsed.analysis }]
  }
  return [expandEntry(parsed)]
}

// JSON이 max_tokens로 잘린 경우 마지막 완전한 항목까지 복구
function recoverTruncatedJson(content: string): string {
  // {"e":[ ... ,{완전한 항목}, {잘린 항목  까지 올 수 있음
  // 마지막 완전한 }를 찾아서 그 뒤를 자르고 ]} 추가
  const lastCompleteObj = content.lastIndexOf('},')
  if (lastCompleteObj > 0) {
    return content.substring(0, lastCompleteObj + 1) + ']}'
  }
  const lastObj = content.lastIndexOf('}')
  if (lastObj > 0) {
    return content.substring(0, lastObj + 1) + ']}'
  }
  throw new Error('JSON 복구 실패')
}

// ============================================================
// 유틸리티
// ============================================================

function jsonError(message: string, status: number) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}
