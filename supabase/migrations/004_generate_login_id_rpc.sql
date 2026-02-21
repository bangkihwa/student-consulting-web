-- ============================================================
-- RPC: RLS를 우회하여 전체 학생 기준으로 다음 login_id 생성
-- ============================================================

CREATE OR REPLACE FUNCTION sm_generate_student_login_id(
  p_prefix TEXT  -- 예: 'h01', 'm02'
)
RETURNS TEXT AS $$
DECLARE
  v_last_id TEXT;
  v_seq INTEGER := 1;
BEGIN
  SELECT student_login_id INTO v_last_id
  FROM sm_students
  WHERE student_login_id LIKE p_prefix || '%'
  ORDER BY student_login_id DESC
  LIMIT 1;

  IF v_last_id IS NOT NULL THEN
    v_seq := CAST(substring(v_last_id FROM length(p_prefix) + 1) AS INTEGER) + 1;
  END IF;

  RETURN p_prefix || lpad(v_seq::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION sm_generate_student_login_id TO authenticated;
