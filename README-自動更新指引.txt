MACD Personal Desk — 自動市場快照更新包

此更新包會保留你的持倉及交易紀錄在瀏覽器，只有公開市場快照會由 GitHub 每個交易日自動更新。

請跟以下步驟更新現有 GitHub repository：

1. 解壓這個 ZIP。
2. 到 GitHub 的 macd-personal-desk repository，按 Add file → Upload files。
3. 將解壓後資料夾內的所有內容拖到上傳頁面：
   - index.html
   - assets 資料夾
   - market-snapshot.json
   - .github 資料夾
   - scripts 資料夾
4. GitHub 如提示檔案已存在，確認覆蓋 index.html 與 assets 內新檔案。
5. 按 Commit changes。
6. 回到 repository 的 Actions 頁面，按 Enable Actions（如有提示）。
7. 在左邊選「Update daily market snapshot」，按 Run workflow → Run workflow 一次，以確認自動更新可運作。

說明：
- 工作流程每個星期一至五 22:30 UTC（香港時間翌日約 06:30）嘗試更新一次。
- 只提交公開日線市場快照，不會提交你的持倉、交易紀錄或瀏覽器資料。
- GitHub Pages 網址保持不變。開啟網站或按「更新」時，系統會讀取最新快照並把訊號套用到你的本機紀錄。
