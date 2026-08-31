output "helloworld_namespace" {
  value = kubernetes_namespace.helloworld.metadata[0].name
}

output "grafana_access_hint" {
  value = "kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80"
}