# frozen_string_literal: true

Rails.application.routes.draw do
  # Health check
  get 'health' => 'health#show'
  get 'up' => 'rails/health#show', as: :rails_health_check

  # ActionCable WebSocket
  mount ActionCable.server => '/cable'

  # API routes
  namespace :api do
    namespace :v1 do
      # ===========================================
      # PUBLIC ENDPOINTS (no auth required)
      # ===========================================

      # Organizations (public)
      get 'organizations/:slug' => 'organizations#show'
      get 'organizations/:slug/tournaments' => 'organizations#tournaments'
      get 'organizations/:slug/tournaments/:tournament_slug' => 'organizations#tournament'

      # Current tournament (legacy, for backwards compatibility)
      get 'tournaments/current' => 'tournaments#current'

      # Registration (public)
      get 'golfers/registration_status' => 'golfers#registration_status'
      post 'golfers' => 'golfers#create'

      # Payment Links (public endpoints)
      get 'payment_links/:token' => 'payment_links#show'
      post 'payment_links/:token/checkout' => 'payment_links#create_checkout'

      # Checkout (public)
      post 'checkout' => 'checkout#create'
      post 'checkout/embedded' => 'checkout#create_embedded'
      post 'checkout/confirm' => 'checkout#confirm'
      post 'checkout/swipe_simple' => 'checkout#swipe_simple_redirect'
      get 'checkout/session/:session_id' => 'checkout#session_status'

      # Webhooks (public, authenticated via signature)
      post 'webhooks/stripe' => 'webhooks#stripe'

      # Golfer Auth (public - for scoring access)
      post 'golfer_auth/request_link' => 'golfer_auth#request_link'
      get 'golfer_auth/verify' => 'golfer_auth#verify'
      get 'golfer_auth/me' => 'golfer_auth#me'
      post 'golfer_auth/refresh' => 'golfer_auth#refresh'

      # Sponsor Portal (public, token-authenticated)
      post 'sponsor_access/request_link' => 'sponsor_access#request_link'
      get 'sponsor_access/verify' => 'sponsor_access#verify'
      post 'sponsor_access/confirm' => 'sponsor_access#confirm'
      resources :sponsor_slots, only: [:index, :update]

      # ===========================================
      # ADMIN ENDPOINTS (auth required)
      # ===========================================

      # Admin uploads
      post 'admin/uploads' => 'admin/uploads#create'
      post 'admin/uploads/presigned' => 'admin/uploads#presigned'

      # Admin organizations
      get 'admin/organizations' => 'organizations#index'
      patch 'admin/organizations/:slug' => 'organizations#update'
      get 'admin/organizations/:slug/members' => 'organizations#members'
      post 'admin/organizations/:slug/members' => 'organizations#add_member'
      patch 'admin/organizations/:slug/members/:member_id' => 'organizations#update_member'
      delete 'admin/organizations/:slug/members/:member_id' => 'organizations#remove_member'
      post 'admin/organizations/:slug/members/:member_id/resend_invite' => 'organizations#resend_invite'
      get 'admin/organizations/:slug/tournaments' => 'organizations#admin_tournaments'
      post 'admin/organizations/:slug/tournaments' => 'organizations#create_tournament'
      get 'admin/organizations/:slug/tournaments/:tournament_slug' => 'organizations#admin_tournament'
      post 'admin/organizations/:slug/tournaments/:tournament_slug/golfers' => 'organizations#create_golfer'
      patch 'admin/organizations/:slug/tournaments/:tournament_slug/golfers/:golfer_id' => 'organizations#update_golfer'
      post 'admin/organizations/:slug/tournaments/:tournament_slug/golfers/:golfer_id/cancel' => 'organizations#cancel_golfer'
      post 'admin/organizations/:slug/tournaments/:tournament_slug/golfers/:golfer_id/refund' => 'organizations#refund_golfer'

      # Tournaments (admin)
      resources :tournaments, except: [:create] do
        member do
          post :archive
          post :copy
          post :open
          post :close
          post :complete
        end
      end
      post 'admin/tournaments' => 'tournaments#create'

      # Golfers (admin)
      resources :golfers, except: [:create] do
        member do
          post :check_in
          post :undo_check_in
          post :verify_payment
          post :payment_details
          post :promote
          post :demote
          post :update_payment_status
          post :cancel
          post :refund
          post :mark_refunded
          patch :mark_paid
          post :send_payment_link
        end
        collection do
          get :stats
          post :bulk_send_payment_links
        end
      end

      # Scores & Leaderboard
      scope 'tournaments/:tournament_id' do
        resources :scores, only: [:index, :create, :update, :destroy] do
          member do
            post :verify
          end
          collection do
            get :leaderboard
            get :scorecard
            post :batch
          end
        end

        # Raffle (public)
        get 'raffle/prizes' => 'raffle#prizes'
        get 'raffle/board' => 'raffle#board'
        get 'raffle/tickets' => 'raffle#tickets'

        # Raffle (admin)
        post 'raffle/prizes' => 'raffle#create_prize'
        patch 'raffle/prizes/:id' => 'raffle#update_prize'
        delete 'raffle/prizes/:id' => 'raffle#destroy_prize'
        post 'raffle/prizes/:id/draw' => 'raffle#draw'
        post 'raffle/prizes/:id/reset' => 'raffle#reset_prize'
        post 'raffle/prizes/:id/claim' => 'raffle#claim_prize'
        post 'raffle/prizes/:id/resend_notification' => 'raffle#resend_winner_notification'
        post 'raffle/draw_all' => 'raffle#draw_all'
        get 'raffle/admin/tickets' => 'raffle#admin_tickets'
        post 'raffle/tickets' => 'raffle#create_tickets'
        post 'raffle/tickets/:id/mark_paid' => 'raffle#mark_ticket_paid'
        post 'raffle/tickets/:id/resend_confirmation' => 'raffle#resend_ticket_confirmation'
        delete 'raffle/tickets/:id' => 'raffle#destroy_ticket'
        post 'raffle/tickets/:id/void' => 'raffle#void_ticket'
        post 'raffle/sync_tickets' => 'raffle#sync_tickets'
        post 'raffle/sell' => 'raffle#sell_tickets'

        # Sponsors
        resources :sponsors, only: [:index, :show, :create, :update, :destroy] do
          collection do
            get :by_hole
            post :reorder
          end
          member do
            get :slots
            patch 'slots/:slot_id', action: :update_slot, as: :update_slot
          end
        end
      end

      # Groups
      resources :groups do
        member do
          post :set_hole
          post :add_golfer
          post :merge_into
          post :remove_golfer
        end
        collection do
          post :place_golfer
          post :update_positions
          post :batch_create
          post :auto_assign
        end
      end

      # Users/Admins (legacy endpoint name for backwards compatibility)
      resources :admins do
        collection do
          get :me
        end
      end

      # Settings (singleton resource)
      resource :settings, only: %i[show update]

      # Activity Logs
      resources :activity_logs, only: [:index] do
        collection do
          get :summary
          get 'golfer/:golfer_id', action: :golfer_history, as: :golfer_history
        end
      end
    end
  end
end
