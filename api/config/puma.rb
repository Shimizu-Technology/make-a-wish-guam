threads_count = ENV.fetch("RAILS_MAX_THREADS", 5)
threads threads_count, threads_count

port ENV.fetch("PORT", 3000)

# Single-mode (workers=0) saves ~100MB RAM on small instances like Render 512MB.
# Cluster mode with 1 worker wastes memory on the master process for no benefit.
workers ENV.fetch("WEB_CONCURRENCY", 0)

plugin :tmp_restart
plugin :solid_queue if ENV["SOLID_QUEUE_IN_PUMA"]
pidfile ENV["PIDFILE"] if ENV["PIDFILE"]

# Preload app in production to speed up worker boot and share memory via COW
preload_app! if ENV.fetch("RAILS_ENV", "development") == "production"

on_worker_boot do
  ActiveRecord::Base.establish_connection if defined?(ActiveRecord)
end
