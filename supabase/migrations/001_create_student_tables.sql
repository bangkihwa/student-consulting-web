-- ============================================================
-- 입시 컨설팅 학생 관리 시스템 - 테이블 생성
-- 접두사 sm_ 사용 (기존 테이블과 충돌 방지)
-- ============================================================

-- 테이블 1: sm_students (학생 기본 정보 + 인증)
CREATE TABLE sm_students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_login_id TEXT NOT NULL UNIQUE,
  access_code TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  grade TEXT NOT NULL DEFAULT '',
  enrollment_year INTEGER,
  graduation_year INTEGER,
  high_school_name TEXT NOT NULL DEFAULT '',
  student_phone TEXT NOT NULL DEFAULT '',
  parent_phone TEXT NOT NULL DEFAULT '',
  consultant_name TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION sm_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sm_students_updated_at
  BEFORE UPDATE ON sm_students
  FOR EACH ROW EXECUTE FUNCTION sm_update_updated_at();

CREATE INDEX idx_sm_students_login_id ON sm_students(student_login_id);
CREATE INDEX idx_sm_students_created_by ON sm_students(created_by);

-- 테이블 2: sm_career_goals (진로 및 목표 정보, 학생당 1개)
CREATE TABLE sm_career_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL UNIQUE REFERENCES sm_students(id) ON DELETE CASCADE,
  career_field_1st TEXT NOT NULL DEFAULT '',
  career_detail_1st TEXT NOT NULL DEFAULT '',
  career_field_2nd TEXT NOT NULL DEFAULT '',
  career_detail_2nd TEXT NOT NULL DEFAULT '',
  target_univ_1_name TEXT NOT NULL DEFAULT '',
  target_univ_1_dept TEXT NOT NULL DEFAULT '',
  target_univ_2_name TEXT NOT NULL DEFAULT '',
  target_univ_2_dept TEXT NOT NULL DEFAULT '',
  target_univ_3_name TEXT NOT NULL DEFAULT '',
  target_univ_3_dept TEXT NOT NULL DEFAULT '',
  target_tier TEXT NOT NULL DEFAULT ''
    CHECK (target_tier IN ('', '최상위', '상위', '중상위', '중위')),
  admission_hakjong_ratio INTEGER NOT NULL DEFAULT 0,
  admission_gyogwa_ratio INTEGER NOT NULL DEFAULT 0,
  admission_nonsul_ratio INTEGER NOT NULL DEFAULT 0,
  admission_jeongsi_ratio INTEGER NOT NULL DEFAULT 0,
  field_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  special_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER tr_sm_career_goals_updated_at
  BEFORE UPDATE ON sm_career_goals
  FOR EACH ROW EXECUTE FUNCTION sm_update_updated_at();

CREATE INDEX idx_sm_career_goals_student_id ON sm_career_goals(student_id);

-- 테이블 3: sm_career_change_history (진로 변경 이력, 학생당 N개)
CREATE TABLE sm_career_change_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES sm_students(id) ON DELETE CASCADE,
  change_date DATE NOT NULL,
  previous_career TEXT NOT NULL DEFAULT '',
  new_career TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER tr_sm_career_change_history_updated_at
  BEFORE UPDATE ON sm_career_change_history
  FOR EACH ROW EXECUTE FUNCTION sm_update_updated_at();

CREATE INDEX idx_sm_career_history_student_id ON sm_career_change_history(student_id);
CREATE INDEX idx_sm_career_history_date ON sm_career_change_history(change_date);

-- 테이블 4: sm_student_sessions (학생 세션 관리)
CREATE TABLE sm_student_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES sm_students(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sm_sessions_token ON sm_student_sessions(session_token);
CREATE INDEX idx_sm_sessions_student_id ON sm_student_sessions(student_id);
