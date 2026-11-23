variable "db_url" {
  type    = string
  default = "postgres://postgres:postgres@localhost:5432/silver_cock?sslmode=disable"
}

env "local" {
  src = "file://schema.sql"
  url = var.db_url
  dev = "docker://postgres/16/dev"
  migration {
    dir = "file://migrations"
  }
  format {
    migrate {
      diff = "{{ sql . \"  \" }}"
    }
  }
}
