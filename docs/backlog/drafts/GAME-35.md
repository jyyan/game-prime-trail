## 新增

- 【測試・低】e2e/15-demo.spec.ts 的卡住截圖依賴隨機地圖：快轉時要找到「有 ✕ 且有紅框（trap／twoEnds／split）」的卡住畫面，最多換 6 張圖；以 B1 的原因分布（twoEnds／split 常見）實際很少落空，但仍是機率性的，若出現偶發失敗可改用 e2e hook 注入固定 seed 或固定 levelId。
