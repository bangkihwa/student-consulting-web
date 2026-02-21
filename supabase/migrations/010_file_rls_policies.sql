-- ============================================================
-- 파일 업로드 테이블 RLS 정책
-- ============================================================

ALTER TABLE sm_uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE sm_file_analysis ENABLE ROW LEVEL SECURITY;

-- 관리자: 자신이 만든 학생의 파일만 관리
CREATE POLICY "admin_manage_uploaded_files"
  ON sm_uploaded_files FOR ALL
  USING (EXISTS (
    SELECT 1 FROM sm_students s
    WHERE s.id = sm_uploaded_files.student_id AND s.created_by = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM sm_students s
    WHERE s.id = sm_uploaded_files.student_id AND s.created_by = auth.uid()
  ));

-- 관리자: 자신이 만든 학생의 분석 결과만 관리
CREATE POLICY "admin_manage_file_analysis"
  ON sm_file_analysis FOR ALL
  USING (EXISTS (
    SELECT 1 FROM sm_students s
    WHERE s.id = sm_file_analysis.student_id AND s.created_by = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM sm_students s
    WHERE s.id = sm_file_analysis.student_id AND s.created_by = auth.uid()
  ));
