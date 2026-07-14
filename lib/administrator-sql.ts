export const insertAdministratorSql = `INSERT INTO administrators (id,email,password_hash,active,must_change_password,last_login_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`;
