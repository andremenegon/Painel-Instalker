-- Atualizar créditos do usuário felipeoliveira@gmail.com

UPDATE user_profiles 
SET credits = 100 
WHERE created_by = 'felipeoliveira@gmail.com';

-- Verificar atualização
SELECT created_by, credits, level, xp 
FROM user_profiles 
WHERE created_by = 'felipeoliveira@gmail.com';
