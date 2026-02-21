-- file_type 체크 제약조건에 이미지 타입 추가
ALTER TABLE sm_uploaded_files
  DROP CONSTRAINT IF EXISTS sm_uploaded_files_file_type_check;

ALTER TABLE sm_uploaded_files
  ADD CONSTRAINT sm_uploaded_files_file_type_check
  CHECK (file_type IN ('pdf', 'docx', 'jpg', 'jpeg', 'png', 'webp', 'gif'));
