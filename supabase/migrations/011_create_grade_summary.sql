-- 성적 요약 테이블 (학기별 등급 평균)
CREATE TABLE IF NOT EXISTS sm_grade_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES sm_students(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  -- 성적 데이터: { "1-1_전교과": 2.3, "1-1_국영수과사": 1.8, ... }
  grades JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id)
);

-- RLS 활성화
ALTER TABLE sm_grade_summary ENABLE ROW LEVEL SECURITY;

-- 정책: 생성자만 접근
CREATE POLICY "grade_summary_select" ON sm_grade_summary
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "grade_summary_insert" ON sm_grade_summary
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "grade_summary_update" ON sm_grade_summary
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "grade_summary_delete" ON sm_grade_summary
  FOR DELETE USING (auth.uid() = created_by);

-- updated_at 자동 갱신
CREATE OR REPLACE TRIGGER update_sm_grade_summary_updated_at
  BEFORE UPDATE ON sm_grade_summary
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
