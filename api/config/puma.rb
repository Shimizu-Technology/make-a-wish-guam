threads_count = ENV.fetch("RAILS_MAX_THREADS", 5)
threads threads_count, threads_count

port ENV.fetch("PORT", 3000)

# Single-mode (workers=0) saves ~100MB RAM on small instances like Render's starter tier.
# Cluster mode with 1 worker wastes memory on the master process for no benefit.
workers ENV.fetch("WEB_CONCURRENCY", 0)

plugin :tmp_restart
plugin :solid_queue if ENV["SOLID_QUEUE_IN_PUMA"]
pidfile ENV["PIDFILE"] if ENV["PIDFILE"]
