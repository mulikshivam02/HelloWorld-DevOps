# rebuild.ps1
Write-Host "Provisioning platform (Terraform)..." -ForegroundColor Cyan
Push-Location terraform
terraform apply -auto-approve
Pop-Location

Write-Host "Deploying app (ArgoCD)..." -ForegroundColor Cyan
kubectl apply -f argocd/application.yaml
argocd app sync helloworld
kubectl wait --for=condition=Ready pod mongodb-0 -n helloworld --timeout=180s

Write-Host "Recreating backend secret..." -ForegroundColor Cyan
Get-Content server\.env -Raw | ForEach-Object { $_ -replace "`r", "" } | Set-Content -NoNewline backend.env.clean
Get-Content backend.env.clean | Where-Object { $_ -notmatch '^(PORT|MONGODB_URL)=' } | Set-Content backend.env
Remove-Item backend.env.clean
kubectl delete secret backend-secrets -n helloworld --ignore-not-found
kubectl create secret generic backend-secrets -n helloworld --from-env-file=backend.env
Remove-Item backend.env
kubectl rollout restart deployment/backend -n helloworld
kubectl rollout status deployment/backend -n helloworld

Write-Host "Restoring Mongo test data..." -ForegroundColor Cyan
$job = Start-Job { kubectl port-forward -n helloworld svc/mongodb 27018:27017 }
Start-Sleep -Seconds 3
mongorestore --uri="mongodb://localhost:27018/test" ./mongo-backup-kind/test
Stop-Job $job; Remove-Job $job

Write-Host "Verifying..." -ForegroundColor Cyan
kubectl get pods -n helloworld
curl.exe -I http://helloworld.local