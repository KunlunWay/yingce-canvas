// 平台镜像（fork 集成）：GlowPix「我的作品」页通过内部 HMAC 端点按 OIDC 账号哈希
// 读取该用户在 YingCe 的作品与存储用量。账号哈希 = sha256(issuer + "\x00" + gatewayUserId)，
// 与 OIDC 登录时写入 user_identities 的 subject 同源。

package app

// platformOIDCProvider 与 auth/oidc.go 的 oidcProvider 常量一致。
const platformOIDCProvider = "oidc"

func (s *Service) platformUserIDByOIDCAccount(accountHash string) (string, error) {
	identity, err := s.repo.UserIdentity(platformOIDCProvider, accountHash)
	if err != nil {
		return "", err
	}
	return identity.UserID, nil
}

// PlatformWorksByOIDCAccount 返回该用户的素材库作品分页（复用素材库列表口径）。
func (s *Service) PlatformWorksByOIDCAccount(accountHash string, page int, pageSize int) (UserAssetPage, error) {
	userID, err := s.platformUserIDByOIDCAccount(accountHash)
	if err != nil {
		return UserAssetPage{}, err
	}
	return s.UserAssetsPage(userID, page, pageSize, UserAssetPageFilter{Status: "active"})
}

// PlatformStorageByOIDCAccount 返回该用户的存储用量。
func (s *Service) PlatformStorageByOIDCAccount(accountHash string) (*AccountFileStorageUsage, error) {
	userID, err := s.platformUserIDByOIDCAccount(accountHash)
	if err != nil {
		return nil, err
	}
	return s.AccountFileStorageUsage(userID)
}
