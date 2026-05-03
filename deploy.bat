@echo off
echo 正在构建游戏...
call npm run build
echo 正在部署到GitHub Pages...
cd dist
git init
git add .
git commit -m "deploy"
git branch -M main
git remote add origin https://github.com/xyh020928/xiu-xian-roguelike.git
git push -f origin main
cd ..
echo 部署完成！
pause
