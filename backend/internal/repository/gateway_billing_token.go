package repository

import (
	"time"

	"gorm.io/gorm"

	"yingce/backend/internal/model"
)

// GatewayBillingToken 读取用户的平台网关计费 token；没有则返回空串。
func (r *Repository) GatewayBillingToken(userID string) (string, error) {
	var row model.GatewayBillingToken
	if err := r.db.Where("user_id = ?", userID).First(&row).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return "", nil
		}
		return "", err
	}
	return row.Token, nil
}

func (r *Repository) SaveGatewayBillingToken(userID string, token string) error {
	now := time.Now()
	row := model.GatewayBillingToken{UserID: userID, Token: token, UpdatedAt: now}
	return r.db.Transaction(func(tx *gorm.DB) error {
		var existing model.GatewayBillingToken
		err := tx.Where("user_id = ?", userID).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			row.CreatedAt = now
			return tx.Create(&row).Error
		}
		if err != nil {
			return err
		}
		return tx.Model(&existing).Updates(map[string]any{"token": token, "updated_at": now}).Error
	})
}
