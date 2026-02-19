-- ============================================================
-- RLS 정책 + RPC 함수
-- ============================================================

-- RLS 활성화
ALTER TABLE sm_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE sm_career_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sm_career_change_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sm_student_sessions ENABLE ROW LEVEL SECURITY;

-- 관리자: 자신이 생성한 학생 CRUD
CREATE POLICY "admin_manage_own_students"
  ON sm_students FOR ALL
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- 관리자: 진로 목표 관리
CREATE POLICY "admin_manage_career_goals"
  ON sm_career_goals FOR ALL
  USING (EXISTS (SELECT 1 FROM sm_students s WHERE s.id = sm_career_goals.student_id AND s.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM sm_students s WHERE s.id = sm_career_goals.student_id AND s.created_by = auth.uid()));

-- 관리자: 진로 변경 이력 관리
CREATE POLICY "admin_manage_career_history"
  ON sm_career_change_history FOR ALL
  USING (EXISTS (SELECT 1 FROM sm_students s WHERE s.id = sm_career_change_history.student_id AND s.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM sm_students s WHERE s.id = sm_career_change_history.student_id AND s.created_by = auth.uid()));

-- 세션 테이블: 직접 접근 불가 (RPC 내부에서만)
CREATE POLICY "no_direct_session_access"
  ON sm_student_sessions FOR ALL
  USING (false);

-- ============================================================
-- 학생용 RPC 함수 (SECURITY DEFINER)
-- ============================================================

-- 학생 로그인 검증 + 세션 토큰 발급
CREATE OR REPLACE FUNCTION sm_verify_student_login(
  p_login_id TEXT,
  p_access_code TEXT
)
RETURNS TABLE(student_id UUID, session_token TEXT) AS $$
DECLARE
  v_student_id UUID;
  v_token TEXT;
BEGIN
  SELECT s.id INTO v_student_id
  FROM sm_students s
  WHERE s.student_login_id = p_login_id
    AND s.access_code = p_access_code
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

-- 세션 토큰으로 학생 ID 조회
CREATE OR REPLACE FUNCTION sm_get_student_by_session(p_session_token TEXT)
RETURNS UUID AS $$
DECLARE
  v_student_id UUID;
BEGIN
  SELECT student_id INTO v_student_id
  FROM sm_student_sessions
  WHERE session_token = p_session_token AND expires_at > now();
  RETURN v_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 학생 프로필 조회
CREATE OR REPLACE FUNCTION sm_get_my_profile(p_session_token TEXT)
RETURNS SETOF sm_students AS $$
DECLARE
  v_student_id UUID;
BEGIN
  v_student_id := sm_get_student_by_session(p_session_token);
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;
  RETURN QUERY SELECT * FROM sm_students WHERE id = v_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 학생 프로필 수정
CREATE OR REPLACE FUNCTION sm_update_my_profile(
  p_session_token TEXT,
  p_name TEXT DEFAULT NULL,
  p_student_phone TEXT DEFAULT NULL,
  p_parent_phone TEXT DEFAULT NULL,
  p_high_school_name TEXT DEFAULT NULL,
  p_enrollment_year INTEGER DEFAULT NULL,
  p_graduation_year INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_student_id UUID;
BEGIN
  v_student_id := sm_get_student_by_session(p_session_token);
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;
  UPDATE sm_students SET
    name = COALESCE(p_name, name),
    student_phone = COALESCE(p_student_phone, student_phone),
    parent_phone = COALESCE(p_parent_phone, parent_phone),
    high_school_name = COALESCE(p_high_school_name, high_school_name),
    enrollment_year = COALESCE(p_enrollment_year, enrollment_year),
    graduation_year = COALESCE(p_graduation_year, graduation_year)
  WHERE id = v_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 진로 목표 조회
CREATE OR REPLACE FUNCTION sm_get_my_career_goals(p_session_token TEXT)
RETURNS SETOF sm_career_goals AS $$
DECLARE
  v_student_id UUID;
BEGIN
  v_student_id := sm_get_student_by_session(p_session_token);
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;
  RETURN QUERY SELECT * FROM sm_career_goals WHERE student_id = v_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 진로 목표 저장/수정 (upsert)
CREATE OR REPLACE FUNCTION sm_upsert_my_career_goals(
  p_session_token TEXT,
  p_career_field_1st TEXT DEFAULT NULL,
  p_career_detail_1st TEXT DEFAULT NULL,
  p_career_field_2nd TEXT DEFAULT NULL,
  p_career_detail_2nd TEXT DEFAULT NULL,
  p_target_univ_1_name TEXT DEFAULT NULL,
  p_target_univ_1_dept TEXT DEFAULT NULL,
  p_target_univ_2_name TEXT DEFAULT NULL,
  p_target_univ_2_dept TEXT DEFAULT NULL,
  p_target_univ_3_name TEXT DEFAULT NULL,
  p_target_univ_3_dept TEXT DEFAULT NULL,
  p_target_tier TEXT DEFAULT NULL,
  p_admission_hakjong_ratio INTEGER DEFAULT NULL,
  p_admission_gyogwa_ratio INTEGER DEFAULT NULL,
  p_admission_nonsul_ratio INTEGER DEFAULT NULL,
  p_admission_jeongsi_ratio INTEGER DEFAULT NULL,
  p_field_keywords JSONB DEFAULT NULL,
  p_special_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_student_id UUID;
BEGIN
  v_student_id := sm_get_student_by_session(p_session_token);
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;

  INSERT INTO sm_career_goals (student_id, career_field_1st, career_detail_1st,
    career_field_2nd, career_detail_2nd,
    target_univ_1_name, target_univ_1_dept,
    target_univ_2_name, target_univ_2_dept,
    target_univ_3_name, target_univ_3_dept,
    target_tier,
    admission_hakjong_ratio, admission_gyogwa_ratio,
    admission_nonsul_ratio, admission_jeongsi_ratio,
    field_keywords, special_notes)
  VALUES (v_student_id,
    COALESCE(p_career_field_1st, ''), COALESCE(p_career_detail_1st, ''),
    COALESCE(p_career_field_2nd, ''), COALESCE(p_career_detail_2nd, ''),
    COALESCE(p_target_univ_1_name, ''), COALESCE(p_target_univ_1_dept, ''),
    COALESCE(p_target_univ_2_name, ''), COALESCE(p_target_univ_2_dept, ''),
    COALESCE(p_target_univ_3_name, ''), COALESCE(p_target_univ_3_dept, ''),
    COALESCE(p_target_tier, ''),
    COALESCE(p_admission_hakjong_ratio, 0), COALESCE(p_admission_gyogwa_ratio, 0),
    COALESCE(p_admission_nonsul_ratio, 0), COALESCE(p_admission_jeongsi_ratio, 0),
    COALESCE(p_field_keywords, '[]'::jsonb), COALESCE(p_special_notes, ''))
  ON CONFLICT (student_id) DO UPDATE SET
    career_field_1st = COALESCE(p_career_field_1st, sm_career_goals.career_field_1st),
    career_detail_1st = COALESCE(p_career_detail_1st, sm_career_goals.career_detail_1st),
    career_field_2nd = COALESCE(p_career_field_2nd, sm_career_goals.career_field_2nd),
    career_detail_2nd = COALESCE(p_career_detail_2nd, sm_career_goals.career_detail_2nd),
    target_univ_1_name = COALESCE(p_target_univ_1_name, sm_career_goals.target_univ_1_name),
    target_univ_1_dept = COALESCE(p_target_univ_1_dept, sm_career_goals.target_univ_1_dept),
    target_univ_2_name = COALESCE(p_target_univ_2_name, sm_career_goals.target_univ_2_name),
    target_univ_2_dept = COALESCE(p_target_univ_2_dept, sm_career_goals.target_univ_2_dept),
    target_univ_3_name = COALESCE(p_target_univ_3_name, sm_career_goals.target_univ_3_name),
    target_univ_3_dept = COALESCE(p_target_univ_3_dept, sm_career_goals.target_univ_3_dept),
    target_tier = COALESCE(p_target_tier, sm_career_goals.target_tier),
    admission_hakjong_ratio = COALESCE(p_admission_hakjong_ratio, sm_career_goals.admission_hakjong_ratio),
    admission_gyogwa_ratio = COALESCE(p_admission_gyogwa_ratio, sm_career_goals.admission_gyogwa_ratio),
    admission_nonsul_ratio = COALESCE(p_admission_nonsul_ratio, sm_career_goals.admission_nonsul_ratio),
    admission_jeongsi_ratio = COALESCE(p_admission_jeongsi_ratio, sm_career_goals.admission_jeongsi_ratio),
    field_keywords = COALESCE(p_field_keywords, sm_career_goals.field_keywords),
    special_notes = COALESCE(p_special_notes, sm_career_goals.special_notes);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 진로 변경 이력 조회
CREATE OR REPLACE FUNCTION sm_get_my_career_history(p_session_token TEXT)
RETURNS SETOF sm_career_change_history AS $$
DECLARE
  v_student_id UUID;
BEGIN
  v_student_id := sm_get_student_by_session(p_session_token);
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;
  RETURN QUERY SELECT * FROM sm_career_change_history
  WHERE student_id = v_student_id ORDER BY change_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 진로 변경 이력 추가
CREATE OR REPLACE FUNCTION sm_add_my_career_history(
  p_session_token TEXT,
  p_change_date DATE,
  p_previous_career TEXT,
  p_new_career TEXT,
  p_reason TEXT DEFAULT ''
)
RETURNS UUID AS $$
DECLARE
  v_student_id UUID;
  v_new_id UUID;
BEGIN
  v_student_id := sm_get_student_by_session(p_session_token);
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;
  INSERT INTO sm_career_change_history (student_id, change_date, previous_career, new_career, reason)
  VALUES (v_student_id, p_change_date, p_previous_career, p_new_career, p_reason)
  RETURNING id INTO v_new_id;
  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 진로 변경 이력 삭제
CREATE OR REPLACE FUNCTION sm_delete_my_career_history(
  p_session_token TEXT,
  p_history_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_student_id UUID;
BEGIN
  v_student_id := sm_get_student_by_session(p_session_token);
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;
  DELETE FROM sm_career_change_history
  WHERE id = p_history_id AND student_id = v_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- anon 사용자에게 RPC 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION sm_verify_student_login TO anon;
GRANT EXECUTE ON FUNCTION sm_get_my_profile TO anon;
GRANT EXECUTE ON FUNCTION sm_update_my_profile TO anon;
GRANT EXECUTE ON FUNCTION sm_get_my_career_goals TO anon;
GRANT EXECUTE ON FUNCTION sm_upsert_my_career_goals TO anon;
GRANT EXECUTE ON FUNCTION sm_get_my_career_history TO anon;
GRANT EXECUTE ON FUNCTION sm_add_my_career_history TO anon;
GRANT EXECUTE ON FUNCTION sm_delete_my_career_history TO anon;
