import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

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

    // 2. FormData 파싱
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const studentId = formData.get('student_id') as string
    const categoryMain = formData.get('category_main') as string
    const changcheType = formData.get('changche_type') as string | null
    const changcheSub = formData.get('changche_sub') as string || ''
    const gyogwaType = formData.get('gyogwa_type') as string | null
    const gyogwaSub = formData.get('gyogwa_sub') as string || ''
    const gyogwaSubjectName = formData.get('gyogwa_subject_name') as string || ''
    const bongsaHours = formData.get('bongsa_hours') as string | null
    const semester = formData.get('semester') as string || ''

    if (!file || !studentId || !categoryMain) {
      return jsonError('파일, 학생 ID, 카테고리는 필수입니다.', 400)
    }

    // 학생이 이 관리자의 학생인지 확인
    const { data: student, error: studentError } = await supabase
      .from('sm_students')
      .select('id')
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

    // 4. DB 레코드 생성 (분석중 상태)
    const { data: fileRecord, error: insertError } = await supabase
      .from('sm_uploaded_files')
      .insert({
        student_id: studentId,
        uploaded_by: user.id,
        file_name: fileName,
        file_type: ext,
        file_size_bytes: file.size,
        storage_path: storagePath,
        semester,
        category_main: categoryMain,
        changche_type: changcheType || null,
        changche_sub: changcheSub,
        gyogwa_type: gyogwaType || null,
        gyogwa_sub: gyogwaSub,
        gyogwa_subject_name: gyogwaSubjectName,
        bongsa_hours: bongsaHours ? parseFloat(bongsaHours) : null,
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

    // 6. OpenAI 분석
    let analysisResult
    try {
      analysisResult = await analyzeWithOpenAI(openaiKey, rawText)
    } catch (aiError) {
      await supabase
        .from('sm_uploaded_files')
        .update({ analysis_status: '실패', analysis_error: `AI 분석 실패: ${aiError}` })
        .eq('id', fileRecord.id)
      return jsonError(`AI 분석 실패: ${aiError}`, 500)
    }

    // 7. 분석 결과 저장
    const { data: analysis, error: analysisError } = await supabase
      .from('sm_file_analysis')
      .insert({
        file_id: fileRecord.id,
        student_id: studentId,
        title: analysisResult.title || '',
        activity_content: analysisResult.activity_content || '',
        conclusion: analysisResult.conclusion || '',
        research_plan: analysisResult.research_plan || '',
        reading_activities: analysisResult.reading_activities || '',
        evaluation_competency: analysisResult.evaluation_competency || '',
        raw_text: rawText.substring(0, 50000), // 최대 50K 문자
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

    // 8. 완료 상태 업데이트
    await supabase
      .from('sm_uploaded_files')
      .update({ analysis_status: '완료' })
      .eq('id', fileRecord.id)

    return new Response(
      JSON.stringify({
        success: true,
        file: { ...fileRecord, analysis_status: '완료' },
        analysis,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return jsonError(`서버 오류: ${err}`, 500)
  }
})

// ============================================================
// 텍스트 추출 함수
// ============================================================

async function extractPdfText(buffer: Uint8Array): Promise<string> {
  // pdf-parse 대신 간단한 PDF 텍스트 추출
  // Deno 환경에서는 pdf-parse가 Node.js 의존성이 있어 직접 구현
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
// OpenAI 분석
// ============================================================

async function analyzeWithOpenAI(apiKey: string, text: string) {
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
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `당신은 한국 고등학생 활동 보고서를 분석하는 전문가입니다.
학생이 작성한 활동 보고서를 읽고, 아래 항목을 추출하여 JSON으로 응답하세요.

추출 항목:
- title: 활동/탐구 제목 (간결하게)
- activity_content: 탐구 과정 요약 (핵심 내용 위주로 3-5문장)
- conclusion: 결과 및 시사점 (2-3문장)
- research_plan: 추가탐구계획 (본문에 있으면 추출, 없으면 빈 문자열)
- reading_activities: 독서활동 (본문에 있으면 추출, 없으면 빈 문자열)
- evaluation_competency: 이 활동에서 드러나는 학생의 핵심 역량 2-3개를 쉼표로 구분
  (예: 탐구력, 논리적사고력, 문제해결력, 창의성, 협업능력, 의사소통능력, 자기주도성, 비판적사고력, 정보활용능력, 리더십)

모든 값은 한국어로 작성하세요. 반드시 유효한 JSON만 응답하세요.`,
        },
        {
          role: 'user',
          content: `다음 활동 보고서를 분석해주세요:\n\n${truncatedText}`,
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
