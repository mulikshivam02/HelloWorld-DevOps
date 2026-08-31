variable "kubeconfig_path" {
  type    = string
  default = "~/.kube/config"
}

variable "kube_context" {
  type    = string
  default = "kind-helloworld"
}

variable "grafana_admin_password" {
  type      = string
  default   = "admin123"
  sensitive = true
}