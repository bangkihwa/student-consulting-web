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

    // Admin용 Supabase client (JWT로 인증된 사용자 확인)
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey)
    const token = authHeader.replace('Bearer ', '')

    // anon key인지 JWT인지 확인 - JWT로 사용자 확인
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) {
      return jsonError('유효하지 않은 인증입니다.', 401)
    }

    // Service role client (RLS 우회)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 2. 요청 파싱 (FormData: 신규 업로드 / JSON: 재분석)
    const contentType = req.headers.get('content-type') || ''

    // 재분석 요청 처리 (JSON)
    if (contentType.includes('application/json')) {
      const body = await req.json()
      if (body.reanalyze && body.file_id) {
        return await handleReanalyze(supabase, user.id, body.file_id, openaiKey)
      }
      return jsonError('잘못된 요청입니다.', 400)
    }

    // 신규 업로드 처리 (FormData)
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const studentId = formData.get('student_id') as string

    if (!file || !studentId) {
      return jsonError('파일과 학생 ID는 필수입니다.', 400)
    }

    // 학생이 이 관리자의 학생인지 확인
    const { data: student, error: studentError } = await supabase
      .from('sm_students')
      .select('id, grade, enrollment_year')
      .eq('id', studentId)
      .eq('created_by', user.id)
      .maybeSingle()

    if (studentError || !student) {
      return jsonError('해당 학생에 대한 권한이 없습니다.', 403)
    }

    // 파일 타입 확인
    const fileName = file.name
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (!ext || !['pdf', 'docx'].includes(ext)) {
      return jsonError('PDF 또는 DOCX 파일만 지원합니다.', 400)
    }

    // 파일 크기 확인 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return jsonError('파일 크기는 10MB 이하여야 합니다.', 400)
    }

    // 3. Supabase Storage에 파일 저장
    const fileId = crypto.randomUUID()
    const storagePath = `${studentId}/${fileId}.${ext}`
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

    // 4. DB 레코드 생성 (분석중 상태 - 메타데이터는 AI 분석 후 업데이트)
    const { data: fileRecord, error: insertError } = await supabase
      .from('sm_uploaded_files')
      .insert({
        student_id: studentId,
        uploaded_by: user.id,
        file_name: fileName,
        file_type: ext,
        file_size_bytes: file.size,
        storage_path: storagePath,
        semester: '',
        category_main: '창체활동',
        changche_type: null,
        changche_sub: '',
        gyogwa_type: null,
        gyogwa_sub: '',
        gyogwa_subject_name: '',
        bongsa_hours: null,
        analysis_status: '분석중',
      })
      .select()
      .single()

    if (insertError || !fileRecord) {
      return jsonError(`DB 저장 실패: ${insertError?.message}`, 500)
    }

    // 5. 텍스트 추출
    let rawText = ''
    try {
      if (ext === 'pdf') {
        rawText = await extractPdfText(new Uint8Array(fileBuffer))
      } else if (ext === 'docx') {
        rawText = await extractDocxText(new Uint8Array(fileBuffer))
      }
    } catch (parseError) {
      await supabase
        .from('sm_uploaded_files')
        .update({ analysis_status: '실패', analysis_error: `텍스트 추출 실패: ${parseError}` })
        .eq('id', fileRecord.id)
      return jsonError(`텍스트 추출 실패: ${parseError}`, 500)
    }

    if (!rawText.trim()) {
      await supabase
        .from('sm_uploaded_files')
        .update({ analysis_status: '실패', analysis_error: '파일에서 텍스트를 추출할 수 없습니다.' })
        .eq('id', fileRecord.id)
      return jsonError('파일에서 텍스트를 추출할 수 없습니다.', 400)
    }

    // 6. OpenAI 분석 (자동 분류 + 내용 분석)
    let analysisResult
    try {
      analysisResult = await analyzeWithOpenAI(openaiKey, rawText, fileName, student.grade, student.enrollment_year)
    } catch (aiError) {
      await supabase
        .from('sm_uploaded_files')
        .update({ analysis_status: '실패', analysis_error: `AI 분석 실패: ${aiError}` })
        .eq('id', fileRecord.id)
      return jsonError(`AI 분석 실패: ${aiError}`, 500)
    }

    // 7. AI 분류 결과로 파일 메타데이터 업데이트
    const classification = analysisResult.classification || {}
    await supabase
      .from('sm_uploaded_files')
      .update({
        semester: classification.semester || '',
        category_main: classification.category_main || '창체활동',
        changche_type: classification.changche_type || null,
        changche_sub: classification.changche_sub || '',
        gyogwa_type: classification.gyogwa_type || null,
        gyogwa_sub: classification.gyogwa_sub || '',
        gyogwa_subject_name: classification.gyogwa_subject_name || '',
        bongsa_hours: classification.bongsa_hours ?? null,
      })
      .eq('id', fileRecord.id)

    // 8. 분석 결과 저장
    const content = analysisResult.analysis || {}
    const { data: analysis, error: analysisError } = await supabase
      .from('sm_file_analysis')
      .insert({
        file_id: fileRecord.id,
        student_id: studentId,
        title: content.title || '',
        activity_content: content.activity_content || '',
        conclusion: content.conclusion || '',
        research_plan: content.research_plan || '',
        reading_activities: content.reading_activities || '',
        evaluation_competency: content.evaluation_competency || '',
        raw_text: rawText.substring(0, 50000),
      })
      .select()
      .single()

    if (analysisError) {
      await supabase
        .from('sm_uploaded_files')
        .update({ analysis_status: '실패', analysis_error: analysisError.message })
        .eq('id', fileRecord.id)
      return jsonError(`분석 결과 저장 실패: ${analysisError.message}`, 500)
    }

    // 9. 완료 상태 업데이트
    await supabase
      .from('sm_uploaded_files')
      .update({ analysis_status: '완료' })
      .eq('id', fileRecord.id)

    // 최신 파일 레코드 조회 (업데이트된 메타데이터 포함)
    const { data: updatedFile } = await supabase
      .from('sm_uploaded_files')
      .select('*')
      .eq('id', fileRecord.id)
      .single()

    return new Response(
      JSON.stringify({
        success: true,
        file: updatedFile || { ...fileRecord, analysis_status: '완료' },
        analysis,
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
  // 파일 조회
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

  // 기존 분석에서 raw_text 가져오기
  const { data: existingAnalysis } = await supabase
    .from('sm_file_analysis')
    .select('raw_text')
    .eq('file_id', fileId)
    .maybeSingle()

  const rawText = existingAnalysis?.raw_text
  if (!rawText) {
    return jsonError('원본 텍스트가 없어 재분석할 수 없습니다.', 400)
  }

  // AI 재분석
  let analysisResult
  try {
    analysisResult = await analyzeWithOpenAI(
      openaiKey,
      rawText,
      fileRecord.file_name,
      fileRecord.sm_students.grade,
      fileRecord.sm_students.enrollment_year,
    )
  } catch (aiError) {
    await supabase
      .from('sm_uploaded_files')
      .update({ analysis_status: '실패', analysis_error: `AI 재분석 실패: ${aiError}` })
      .eq('id', fileId)
    return jsonError(`AI 재분석 실패: ${aiError}`, 500)
  }

  // 분류 메타데이터 업데이트
  const classification = analysisResult.classification || {}
  await supabase
    .from('sm_uploaded_files')
    .update({
      semester: classification.semester || '',
      category_main: classification.category_main || '창체활동',
      changche_type: classification.changche_type || null,
      changche_sub: classification.changche_sub || '',
      gyogwa_type: classification.gyogwa_type || null,
      gyogwa_sub: classification.gyogwa_sub || '',
      gyogwa_subject_name: classification.gyogwa_subject_name || '',
      bongsa_hours: classification.bongsa_hours ?? null,
      analysis_status: '완료',
      analysis_error: null,
    })
    .eq('id', fileId)

  // 분석 결과 업데이트
  const content = analysisResult.analysis || {}
  const { data: analysis, error: analysisError } = await supabase
    .from('sm_file_analysis')
    .upsert({
      file_id: fileId,
      student_id: fileRecord.student_id,
      title: content.title || '',
      activity_content: content.activity_content || '',
      conclusion: content.conclusion || '',
      research_plan: content.research_plan || '',
      reading_activities: content.reading_activities || '',
      evaluation_competency: content.evaluation_competency || '',
      raw_text: rawText,
      is_edited: false,
    }, { onConflict: 'file_id' })
    .select()
    .single()

  if (analysisError) {
    return jsonError(`분석 결과 저장 실패: ${analysisError.message}`, 500)
  }

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
// 텍스트 추출 함수
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
// OpenAI 분석 (자동 분류 + 내용 분석)
// ============================================================

async function analyzeWithOpenAI(
  apiKey: string,
  text: string,
  fileName: string,
  studentGrade: string | null,
  enrollmentYear: number | null,
) {
  // 텍스트가 너무 길면 잘라냄 (GPT-4o-mini 컨텍스트 제한 고려)
  const truncatedText = text.substring(0, 15000)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `당신은 한국 고등학생 생활기록부(생기부) 활동 보고서를 분석하고 분류하는 전문가입니다.

학생이 작성한 활동 보고서를 읽고, 두 가지 작업을 수행하세요:

## 작업 1: 자동 분류 (classification)
문서 내용을 바탕으로 아래 분류 정보를 판별하세요.

### semester (학기)
- 가능한 값: "1-1", "1-2", "2-1", "2-2", "3-1", "3-2"
- 문서에 학년/학기 정보가 있으면 추출
- 파일명에 학년 정보가 있으면 참고 (예: "1학년", "2-1학기")
- 학생의 현재 학년 정보: ${studentGrade ? `${studentGrade}학년` : '미상'}
- 입학연도: ${enrollmentYear || '미상'}
- 판별 불가시 학생 현재 학년의 1학기로 추정 (예: 2학년이면 "2-1")

### category_main (대분류)
- "창체활동": 자율활동, 동아리활동, 진로활동, 봉사활동에 해당하는 경우
- "교과세특": 특정 교과목 수업/수행평가/탐구/발표 등에 해당하는 경우

### 창체활동인 경우:
- changche_type: "자율활동" | "동아리활동" | "진로활동" | "봉사활동"
  - 자율활동: 학급활동, 학교행사, 특강, 프로젝트 등
  - 동아리활동: 동아리 관련 활동, 팀프로젝트, 개인탐구 등
  - 진로활동: 진로탐색, 진로상담, 직업체험, 진로특강 등
  - 봉사활동: 봉사 관련
- changche_sub: 세부유형
  - 자율: "학급활동" | "공동체활동" | "진로연계활동" | "기타"
  - 동아리: "팀프로젝트" | "개인활동" | "독서활동" | "기타"
  - 진로: "학급활동" | "공동체활동" | "진로심화활동" | "기타"

### 교과세특인 경우:
- gyogwa_subject_name: 교과명 (예: "국어", "수학", "영어", "물리학1", "화학1", "생명과학1", "한국사", "통합사회", "통합과학", "정보", "기술가정" 등)
- gyogwa_type: "교과활동(수행)" | "추가활동"
  - 교과활동(수행): 수업 중 수행평가, 발표, 토론, 실험, 보고서 등
  - 추가활동: 교과 외 추가적인 실험, 보고서, 독서 등
- gyogwa_sub: 세부유형
  - 교과활동(수행): "발표" | "토론" | "실험" | "보고서" | "독서" | "기타"
  - 추가활동: "실험" | "보고서" | "독서" | "기타"

### 봉사활동인 경우:
- bongsa_hours: 봉사시간 (숫자, 문서에 명시된 경우)

## 작업 2: 내용 분석 (analysis)
- title: 활동/탐구 제목 (간결하게)
- activity_content: 탐구 과정 요약 (핵심 내용 위주로 3-5문장)
- conclusion: 결과 및 시사점 (2-3문장)
- research_plan: 추가탐구계획 (본문에 있으면 추출, 없으면 빈 문자열)
- reading_activities: 독서활동 (본문에 언급된 도서명/저자 추출, 없으면 빈 문자열. 형식: "도서명/저자")
- evaluation_competency: 이 활동에서 드러나는 학생의 핵심 역량 2-3개를 쉼표로 구분
  (예: 탐구력, 논리적사고력, 문제해결력, 창의성, 협업능력, 의사소통능력, 자기주도성, 비판적사고력, 정보활용능력, 리더십)

## 응답 형식 (반드시 이 JSON 구조를 따르세요):
{
  "classification": {
    "semester": "1-1",
    "category_main": "교과세특",
    "changche_type": null,
    "changche_sub": "",
    "gyogwa_type": "교과활동(수행)",
    "gyogwa_sub": "보고서",
    "gyogwa_subject_name": "화학1",
    "bongsa_hours": null
  },
  "analysis": {
    "title": "...",
    "activity_content": "...",
    "conclusion": "...",
    "research_plan": "...",
    "reading_activities": "...",
    "evaluation_competency": "..."
  }
}

모든 값은 한국어로 작성하세요. 반드시 유효한 JSON만 응답하세요.`,
        },
        {
          role: 'user',
          content: `파일명: ${fileName}\n\n다음 활동 보고서를 분류하고 분석해주세요:\n\n${truncatedText}`,
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

  return JSON.parse(content)
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
