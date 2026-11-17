package model

import "time"

// GatewayBillingToken 保存 GlowPix 平台网关按用户配发的计费 token（fork 集成）。
// 生成任务出站请求命中平台网关渠道时优先使用它，让用量计入用户自己的额度。
type GatewayBillingToken struct {
	UserID    string    `json:"userId" gorm:"primaryKey;size:36"`
	Token     string    `json:"-" gorm:"size:128"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}
