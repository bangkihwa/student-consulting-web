-- ============================================================
-- 학생 로그인 방식 변경: 접속코드 → 이름
-- ============================================================

-- 기존 함수 삭제 후 재생성 (파라미터가 변경되므로)
DROP FUNCTION IF EXISTS sm_verify_student_login(TEXT, TEXT);

-- 학생 로그인: ID + 이름으로 검증
CREATE OR REPLACE FUNCTION sm_verify_student_login(
  p_login_id TEXT,
  p_student_name TEXT
)
RETURNS TABLE(student_id UUID, session_token TEXT) AS $$
DECLARE
  v_student_id UUID;
  v_token TEXT;
BEGIN
  SELECT s.id INTO v_student_id
  FROM sm_students s
  WHERE s.student_login_id = p_login_id
    AND s.name = p_student_name
    AND s.is_active = TRUE;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Invalid login credentials';
  END IF;

  DELETE FROM sm_student_sessions
  WHERE sm_student_sessions.student_id = v_student_id
    AND expires_at < now();

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO sm_student_sessions (student_id, session_token, expires_at)
  VALUES (v_student_id, v_token, now() + interval '24 hours');

  RETURN QUERY SELECT v_student_id, v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- anon 권한 다시 부여
GRANT EXECUTE ON FUNCTION sm_verify_student_login TO anon;
