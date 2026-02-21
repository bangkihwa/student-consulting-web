-- ============================================================
-- 파일 업로드 + AI 분석 테이블
-- ============================================================

-- 테이블 1: sm_uploaded_files (업로드 파일 메타데이터)
CREATE TABLE sm_uploaded_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES sm_students(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,  -- admin auth.uid()

  -- 파일 메타
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx')),
  file_size_bytes INTEGER NOT NULL,
  storage_path TEXT NOT NULL,

  -- 학기 구분
  semester TEXT NOT NULL DEFAULT '' CHECK (semester IN ('', '1-1', '1-2', '2-1', '2-2', '3-1', '3-2')),

  -- 카테고리: 대분류
  category_main TEXT NOT NULL CHECK (category_main IN ('창체활동', '교과세특')),

  -- 창체활동 하위분류
  changche_type TEXT CHECK (changche_type IN ('자율활동', '동아리활동', '진로활동', '봉사활동') OR changche_type IS NULL),
  changche_sub TEXT NOT NULL DEFAULT '',

  -- 교과세특 하위분류
  gyogwa_type TEXT CHECK (gyogwa_type IN ('교과활동(수행)', '추가활동') OR gyogwa_type IS NULL),
  gyogwa_sub TEXT NOT NULL DEFAULT '',
  gyogwa_subject_name TEXT NOT NULL DEFAULT '',

  -- 봉사활동 시간
  bongsa_hours NUMERIC CHECK (bongsa_hours IS NULL OR bongsa_hours > 0),

  -- AI 분석 상태
  analysis_status TEXT NOT NULL DEFAULT '대기중'
    CHECK (analysis_status IN ('대기중', '분석중', '완료', '실패')),
  analysis_error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER tr_sm_uploaded_files_updated_at
  BEFORE UPDATE ON sm_uploaded_files
  FOR EACH ROW EXECUTE FUNCTION sm_update_updated_at();

CREATE INDEX idx_sm_uploaded_files_student_id ON sm_uploaded_files(student_id);
CREATE INDEX idx_sm_uploaded_files_uploaded_by ON sm_uploaded_files(uploaded_by);
CREATE INDEX idx_sm_uploaded_files_status ON sm_uploaded_files(analysis_status);

-- 테이블 2: sm_file_analysis (AI 분석 결과, 파일 1:1)
CREATE TABLE sm_file_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID NOT NULL UNIQUE REFERENCES sm_uploaded_files(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES sm_students(id) ON DELETE CASCADE,

  -- AI 추출 항목
  title TEXT NOT NULL DEFAULT '',
  activity_content TEXT NOT NULL DEFAULT '',
  conclusion TEXT NOT NULL DEFAULT '',
  research_plan TEXT NOT NULL DEFAULT '',
  reading_activities TEXT NOT NULL DEFAULT '',
  evaluation_competency TEXT NOT NULL DEFAULT '',

  -- 원본 텍스트 (재분석용)
  raw_text TEXT NOT NULL DEFAULT '',

  -- 사용자 수정 여부
  is_edited BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER tr_sm_file_analysis_updated_at
  BEFORE UPDATE ON sm_file_analysis
  FOR EACH ROW EXECUTE FUNCTION sm_update_updated_at();

CREATE INDEX idx_sm_file_analysis_file_id ON sm_file_analysis(file_id);
CREATE INDEX idx_sm_file_analysis_student_id ON sm_file_analysis(student_id);
