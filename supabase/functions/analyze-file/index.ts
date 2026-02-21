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
    if (!ext || !['pdf', 'docx'].includes(ext)) {
      return jsonError('PDF 또는 DOCX 파일만 지원합니다.', 400)
    }
    if (file.size > 10 * 1024 * 1024) {
      return jsonError('파일 크기는 10MB 이하여야 합니다.', 400)
    }

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

    // 4. 텍스트 추출
    let rawText = ''
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
    let entries: any[] = []
    try {
      entries = await extractAllEntries(openaiKey, rawText, fileName, student.grade, student.enrollment_year)
    } catch (aiError) {
      return jsonError(`AI 분석 실패: ${aiError}`, 500)
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
// AI: 문서에서 모든 활동 항목을 개별 추출
// ============================================================

async function extractAllEntries(
  apiKey: string,
  text: string,
  fileName: string,
  studentGrade: string | null,
  enrollmentYear: number | null,
): Promise<any[]> {
  // 텍스트 제한 확장 (60K 문자)
  const inputText = text.substring(0, 60000)

  const systemPrompt = `당신은 한국 고등학생 생활기록부(생기부) 문서를 분석하여 모든 활동 기록을 개별 항목으로 추출하는 전문가입니다.

## 핵심 규칙
- 문서에 포함된 **모든** 활동/교과 기록을 빠짐없이 각각 별도의 항목으로 추출하세요.
- 하나의 문서에 창체활동(자율/동아리/진로/봉사)과 교과세특(국어/수학/영어/과학 등)이 섞여 있을 수 있습니다.
- 한 교과 안에서도 여러 활동(발표, 토론, 수행평가, 탐구 등)이 있으면 각각 별도 항목으로 분리하세요.
- 학생 현재 학년: ${studentGrade ? `${studentGrade}학년` : '미상'}, 입학연도: ${enrollmentYear || '미상'}

## 각 항목에서 추출할 필드

### 분류 필드
- **semester**: 학기 ("1-1", "1-2", "2-1", "2-2", "3-1", "3-2"). 문서에 학년/학기 표시가 있으면 그대로, 없으면 맥락으로 추정.
- **category_main**: "창체활동" 또는 "교과세특"
- **changche_type**: 창체활동인 경우 "자율활동" | "동아리활동" | "진로활동" | "봉사활동", 교과세특이면 null
- **changche_sub**: 창체활동의 구체적 활동명 (예: "특강", "신문활용교육", "교육과정박람회", "실험", "프로젝트" 등). 자유롭게 기술. 교과세특이면 빈 문자열.
- **gyogwa_subject_name**: 교과세특인 경우 교과명 (예: "국어", "수학", "영어", "물리학1", "화학1", "생명과학1", "통합사회", "통합과학", "정보", "기술가정", "한국사" 등). 창체활동이면 빈 문자열.
- **gyogwa_type**: 교과세특인 경우 "교과활동(수행)" 또는 "추가활동", 창체활동이면 null
- **gyogwa_sub**: 교과세특의 구체적 활동명 (예: "발표", "토론", "실험", "보고서", "교과활동", "수행", "자율탐구", "주제탐구", "독서논술" 등). 자유롭게 기술. 창체활동이면 빈 문자열.
- **bongsa_hours**: 봉사활동인 경우 시간 (숫자), 아니면 null

### 내용 필드
- **title**: 활동 제목/주제 (간결하게, 예: "유클리드 기하학의 대수적 접근 특강")
- **activity_content**: 주제/구체적인 내용 (상세 내용, 핵심 위주로)
- **conclusion**: 후속활동, 소감 (문서에 있으면 추출, 없으면 빈 문자열)
- **research_plan**: 추가탐구계획 (문서에 있으면 추출, 없으면 빈 문자열)
- **reading_activities**: 독서활동 (도서명/저자 형식, 없으면 빈 문자열)
- **evaluation_competency**: 평가역량 (쉼표 구분, 예: "탐구역량, 성실성, 비판적사고력")

## 참고: 권윤성 생기부 정리 엑셀 예시 (이런 형식으로 추출)
학기=1학년, 분류=자율, 활동=특강, 평가=탐구역량, 주제=유클리드 기하학의 대수적 접근 특강 참여
학기=1학년, 분류=동아리, 활동=자유주제탐구, 평가=탐구역량, 주제=뉴럴링크 조사, 후속=뉴럴링크의 양면성 고찰
학기=1학년, 분류=국어, 활동=토론, 평가=자기주도성/비판적사고, 주제=의과대학 정원 늘려야 한다 찬성, 독서=언어의 높이뛰기/신지영
학기=2학년, 분류=수학1, 활동=발표, 평가=학업역량/탐구역량/진로역량, 주제=AI 딥러닝에서 사용되는 지수 로그함수 및 삼각함수의 수학적 원리탐구

## 응답 형식
반드시 아래 JSON 형식으로 응답하세요:
{
  "entries": [
    {
      "semester": "1-1",
      "category_main": "창체활동",
      "changche_type": "자율활동",
      "changche_sub": "특강",
      "gyogwa_subject_name": "",
      "gyogwa_type": null,
      "gyogwa_sub": "",
      "bongsa_hours": null,
      "title": "유클리드 기하학의 대수적 접근 특강",
      "activity_content": "특강 참여, 그뢰브너 기저 관련 소감문 작성",
      "conclusion": "",
      "research_plan": "",
      "reading_activities": "",
      "evaluation_competency": "탐구역량"
    }
  ]
}

빠짐없이 모든 항목을 추출하세요. 문서가 길더라도 끝까지 읽고 모든 활동을 추출해야 합니다.`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 16384,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `파일명: ${fileName}\n\n다음 생기부 문서에서 모든 활동 항목을 개별적으로 추출해주세요:\n\n${inputText}` },
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

  const parsed = JSON.parse(content)

  // entries 배열 추출
  if (Array.isArray(parsed.entries)) {
    return parsed.entries
  }
  // 이전 형식 호환 (단건)
  if (parsed.classification && parsed.analysis) {
    return [{
      ...parsed.classification,
      ...parsed.analysis,
    }]
  }
  // 단일 항목
  return [parsed]
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
