# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_05_11_110000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.bigint "record_id", null: false
    t.string "record_type", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.string "key", null: false
    t.text "metadata"
    t.string "service_name", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "activity_logs", force: :cascade do |t|
    t.string "action", null: false
    t.bigint "admin_id"
    t.datetime "created_at", null: false
    t.text "details"
    t.jsonb "metadata", default: {}
    t.integer "target_id"
    t.string "target_name"
    t.string "target_type"
    t.bigint "tournament_id"
    t.datetime "updated_at", null: false
    t.index ["action"], name: "index_activity_logs_on_action"
    t.index ["admin_id"], name: "index_activity_logs_on_admin_id"
    t.index ["created_at"], name: "index_activity_logs_on_created_at"
    t.index ["target_type", "target_id"], name: "index_activity_logs_on_target_type_and_target_id"
    t.index ["tournament_id"], name: "index_activity_logs_on_tournament_id"
  end

  create_table "golfers", force: :cascade do |t|
    t.string "address"
    t.datetime "checked_in_at"
    t.integer "checked_in_by_id"
    t.string "checked_in_by_name"
    t.string "company"
    t.datetime "created_at", null: false
    t.string "email"
    t.bigint "group_id"
    t.integer "hole_number"
    t.boolean "is_employee", default: false, null: false
    t.boolean "is_team_captain", default: true
    t.datetime "magic_link_expires_at"
    t.string "magic_link_token"
    t.string "mobile"
    t.string "name"
    t.text "notes"
    t.datetime "paid_at"
    t.string "partner_email"
    t.string "partner_name"
    t.string "partner_phone"
    t.string "partner_tshirt_size"
    t.datetime "partner_waiver_accepted_at"
    t.integer "payment_amount_cents"
    t.string "payment_method"
    t.text "payment_notes"
    t.string "payment_status"
    t.string "payment_token"
    t.string "payment_type"
    t.datetime "payment_verified_at"
    t.integer "payment_verified_by_id"
    t.string "payment_verified_by_name"
    t.string "phone"
    t.integer "position"
    t.string "raffle_bundle_label"
    t.integer "raffle_tickets_requested", default: 0, null: false
    t.string "receipt_number"
    t.integer "refund_amount_cents"
    t.text "refund_reason"
    t.datetime "refunded_at"
    t.integer "refunded_by_id"
    t.string "registration_source", default: "public"
    t.string "registration_status"
    t.bigint "sponsor_id"
    t.string "sponsor_name"
    t.string "stripe_card_brand"
    t.string "stripe_card_last4"
    t.string "stripe_checkout_session_id"
    t.string "stripe_payment_intent_id"
    t.string "stripe_refund_id"
    t.string "team_category"
    t.string "team_name"
    t.bigint "tournament_id", null: false
    t.string "tshirt_size"
    t.datetime "updated_at", null: false
    t.datetime "waiver_accepted_at"
    t.index ["group_id"], name: "index_golfers_on_group_id"
    t.index ["magic_link_token"], name: "index_golfers_on_magic_link_token", unique: true, where: "(magic_link_token IS NOT NULL)"
    t.index ["paid_at"], name: "index_golfers_on_paid_at"
    t.index ["payment_token"], name: "index_golfers_on_payment_token", unique: true
    t.index ["payment_verified_at"], name: "index_golfers_on_payment_verified_at"
    t.index ["sponsor_id"], name: "index_golfers_on_sponsor_id"
    t.index ["stripe_checkout_session_id"], name: "index_golfers_on_stripe_checkout_session_id", unique: true, where: "(stripe_checkout_session_id IS NOT NULL)"
    t.index ["stripe_refund_id"], name: "index_golfers_on_stripe_refund_id", unique: true, where: "(stripe_refund_id IS NOT NULL)"
    t.index ["tournament_id", "email"], name: "index_golfers_on_tournament_id_and_email"
    t.index ["tournament_id", "email"], name: "index_golfers_on_tournament_id_and_email_public_unique", unique: true, where: "(((COALESCE(registration_source, 'public'::character varying))::text <> 'admin'::text) AND ((registration_status)::text IS DISTINCT FROM 'cancelled'::text))"
    t.index ["tournament_id"], name: "index_golfers_on_tournament_id"
  end

  create_table "groups", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "group_number"
    t.integer "hole_number"
    t.string "starting_course_key"
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.index ["tournament_id", "starting_course_key", "hole_number"], name: "index_groups_on_tournament_course_and_hole"
    t.index ["tournament_id"], name: "index_groups_on_tournament_id"
  end

  create_table "organization_memberships", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.uuid "organization_id", null: false
    t.string "role", default: "member"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["organization_id"], name: "index_organization_memberships_on_organization_id"
    t.index ["user_id", "organization_id"], name: "index_organization_memberships_on_user_id_and_organization_id", unique: true
    t.index ["user_id"], name: "index_organization_memberships_on_user_id"
  end

  create_table "organizations", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "banner_url"
    t.string "contact_email"
    t.string "contact_phone"
    t.datetime "created_at", null: false
    t.text "description"
    t.string "logo_url"
    t.string "name", null: false
    t.string "primary_color", default: "#16a34a"
    t.jsonb "settings", default: {}
    t.string "slug", null: false
    t.string "subscription_status", default: "active"
    t.datetime "updated_at", null: false
    t.string "website_url"
    t.index ["slug"], name: "index_organizations_on_slug", unique: true
  end

  create_table "raffle_prizes", force: :cascade do |t|
    t.boolean "claimed", default: false
    t.datetime "claimed_at"
    t.datetime "created_at", null: false
    t.text "description"
    t.string "image_url"
    t.string "name", null: false
    t.integer "position", default: 0
    t.string "sponsor_logo_url"
    t.string "sponsor_name"
    t.string "tier", default: "standard"
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.integer "value_cents", default: 0
    t.string "winner_email"
    t.string "winner_name"
    t.string "winner_phone"
    t.bigint "winning_ticket_id"
    t.boolean "won", default: false
    t.datetime "won_at"
    t.index ["tournament_id", "position"], name: "index_raffle_prizes_on_tournament_id_and_position"
    t.index ["tournament_id", "tier"], name: "index_raffle_prizes_on_tournament_id_and_tier"
    t.index ["tournament_id"], name: "index_raffle_prizes_on_tournament_id"
  end

  create_table "raffle_sale_batches", force: :cascade do |t|
    t.string "buyer_email"
    t.string "buyer_name"
    t.string "buyer_phone"
    t.datetime "created_at", null: false
    t.string "payment_method"
    t.text "payment_notes"
    t.datetime "purchased_at"
    t.integer "quantity", default: 0, null: false
    t.string "receipt_number"
    t.bigint "sold_by_user_id"
    t.integer "total_cents", default: 0, null: false
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.index ["sold_by_user_id"], name: "index_raffle_sale_batches_on_sold_by_user_id"
    t.index ["tournament_id", "purchased_at"], name: "index_raffle_sale_batches_on_tournament_id_and_purchased_at"
    t.index ["tournament_id"], name: "index_raffle_sale_batches_on_tournament_id"
  end

  create_table "raffle_tickets", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "drawn_at"
    t.bigint "golfer_id"
    t.boolean "is_winner", default: false
    t.string "payment_method"
    t.text "payment_notes"
    t.string "payment_status", default: "pending"
    t.integer "price_cents", default: 0
    t.datetime "purchased_at"
    t.string "purchaser_email"
    t.string "purchaser_name"
    t.string "purchaser_phone"
    t.bigint "raffle_prize_id"
    t.bigint "raffle_sale_batch_id"
    t.string "receipt_number"
    t.integer "sequence_number"
    t.bigint "sold_by_user_id"
    t.string "stripe_payment_intent_id"
    t.string "ticket_number", null: false
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.string "void_reason"
    t.datetime "voided_at"
    t.index ["golfer_id"], name: "index_raffle_tickets_on_golfer_id"
    t.index ["raffle_prize_id"], name: "index_raffle_tickets_on_raffle_prize_id"
    t.index ["raffle_sale_batch_id"], name: "index_raffle_tickets_on_raffle_sale_batch_id"
    t.index ["sold_by_user_id"], name: "index_raffle_tickets_on_sold_by_user_id"
    t.index ["ticket_number"], name: "index_raffle_tickets_on_ticket_number", unique: true
    t.index ["tournament_id", "is_winner"], name: "index_raffle_tickets_on_tournament_id_and_is_winner"
    t.index ["tournament_id", "payment_status"], name: "index_raffle_tickets_on_tournament_id_and_payment_status"
    t.index ["tournament_id", "sequence_number"], name: "index_raffle_tickets_on_tournament_id_and_sequence_number", unique: true
    t.index ["tournament_id"], name: "index_raffle_tickets_on_tournament_id"
  end

  create_table "scores", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "entered_by_id"
    t.bigint "golfer_id"
    t.bigint "group_id", null: false
    t.integer "hole", null: false
    t.text "notes"
    t.integer "par"
    t.integer "relative_score"
    t.string "score_type", default: "individual"
    t.integer "strokes", null: false
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.boolean "verified", default: false
    t.datetime "verified_at"
    t.index ["entered_by_id"], name: "index_scores_on_entered_by_id"
    t.index ["golfer_id"], name: "index_scores_on_golfer_id"
    t.index ["group_id"], name: "index_scores_on_group_id"
    t.index ["score_type"], name: "index_scores_on_score_type"
    t.index ["tournament_id", "golfer_id"], name: "index_scores_on_tournament_id_and_golfer_id"
    t.index ["tournament_id", "group_id", "hole"], name: "index_scores_on_tournament_id_and_group_id_and_hole"
    t.index ["tournament_id", "hole"], name: "index_scores_on_tournament_id_and_hole"
    t.index ["tournament_id"], name: "index_scores_on_tournament_id"
  end

  create_table "settings", force: :cascade do |t|
    t.string "admin_email"
    t.string "checks_payable_to", default: "GIAAEO"
    t.string "contact_name", default: "Peter Torres"
    t.string "contact_phone", default: "671.689.8677"
    t.datetime "created_at", null: false
    t.string "event_date", default: "January 9, 2026"
    t.string "fee_includes", default: "Green Fee, Ditty Bag, Drinks & Food"
    t.string "format_name", default: "Individual Callaway"
    t.string "location_address", default: "Windward Hills, Guam"
    t.string "location_name", default: "Country Club of the Pacific"
    t.integer "max_capacity"
    t.string "payment_mode", default: "test"
    t.boolean "registration_open", default: true, null: false
    t.string "registration_time", default: "11:00 am"
    t.string "start_time", default: "12:30 pm"
    t.string "stripe_public_key"
    t.string "stripe_secret_key"
    t.string "stripe_webhook_secret"
    t.string "tournament_edition", default: "5th"
    t.integer "tournament_entry_fee", default: 12500
    t.string "tournament_name", default: "Edward A.P. Muna II Memorial Golf Tournament"
    t.string "tournament_title", default: "AIRPORT WEEK"
    t.string "tournament_year", default: "2026"
    t.datetime "updated_at", null: false
  end

  create_table "sponsor_slots", force: :cascade do |t|
    t.datetime "confirmed_at"
    t.datetime "created_at", null: false
    t.string "player_email"
    t.string "player_name"
    t.string "player_phone"
    t.integer "slot_number", null: false
    t.bigint "sponsor_id", null: false
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.index ["sponsor_id"], name: "index_sponsor_slots_on_sponsor_id"
    t.index ["tournament_id"], name: "index_sponsor_slots_on_tournament_id"
  end

  create_table "sponsors", force: :cascade do |t|
    t.string "access_token"
    t.datetime "access_token_expires_at"
    t.boolean "active", default: true
    t.string "course_key"
    t.datetime "created_at", null: false
    t.text "description"
    t.integer "hole_number"
    t.string "login_email"
    t.string "logo_url"
    t.string "name", null: false
    t.integer "position", default: 0
    t.integer "slot_count", default: 0
    t.string "tier", default: "bronze"
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.string "website_url"
    t.index ["access_token"], name: "index_sponsors_on_access_token", unique: true, where: "(access_token IS NOT NULL)"
    t.index ["tournament_id", "course_key", "hole_number"], name: "index_sponsors_on_tournament_id_and_course_key_and_hole_number"
    t.index ["tournament_id", "hole_number"], name: "index_sponsors_on_tournament_id_and_hole_number"
    t.index ["tournament_id", "position"], name: "index_sponsors_on_tournament_id_and_position"
    t.index ["tournament_id", "tier"], name: "index_sponsors_on_tournament_id_and_tier"
    t.index ["tournament_id"], name: "index_sponsors_on_tournament_id"
  end

  create_table "tournament_assignments", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["tournament_id"], name: "index_tournament_assignments_on_tournament_id"
    t.index ["user_id", "tournament_id"], name: "index_tournament_assignments_on_user_id_and_tournament_id", unique: true
    t.index ["user_id"], name: "index_tournament_assignments_on_user_id"
  end

  create_table "tournaments", force: :cascade do |t|
    t.string "accent_color_override"
    t.boolean "allow_card", default: true
    t.boolean "allow_cash", default: true
    t.boolean "allow_check", default: true
    t.boolean "allow_partial_teams", default: false
    t.string "banner_url_override"
    t.string "check_in_time"
    t.string "checks_payable_to"
    t.jsonb "config", default: {}
    t.string "contact_email"
    t.string "contact_name"
    t.string "contact_phone"
    t.string "course_name"
    t.decimal "course_rating", precision: 4, scale: 1
    t.datetime "created_at", null: false
    t.datetime "early_bird_deadline"
    t.integer "early_bird_fee"
    t.string "edition"
    t.boolean "employee_discount_enabled", default: false, null: false
    t.integer "employee_entry_fee", default: 5000
    t.integer "entry_fee", default: 12500
    t.string "entry_fee_display", default: "$300/team"
    t.string "event_date"
    t.text "event_schedule"
    t.string "event_type", default: "golf_tournament", null: false
    t.string "fee_includes"
    t.jsonb "flights_config", default: {}
    t.string "format_name"
    t.integer "handicap_max"
    t.boolean "handicap_required", default: false
    t.jsonb "hole_handicaps", default: {}
    t.jsonb "hole_pars", default: {}
    t.string "location_address"
    t.string "location_name"
    t.string "logo_url_override"
    t.integer "max_capacity", default: 160
    t.string "name", null: false
    t.uuid "organization_id", null: false
    t.text "payment_instructions"
    t.string "primary_color_override"
    t.boolean "public_listed", default: true, null: false
    t.boolean "raffle_auto_draw", default: false
    t.text "raffle_description"
    t.datetime "raffle_draw_time"
    t.boolean "raffle_enabled", default: false
    t.integer "raffle_max_tickets_per_person"
    t.integer "raffle_ticket_price_cents", default: 500
    t.integer "raffle_tickets_per_purchase", default: 1
    t.datetime "registration_deadline"
    t.boolean "registration_open", default: false, null: false
    t.string "registration_time"
    t.integer "reserved_slots", default: 0, null: false
    t.string "scoring_type", default: "gross"
    t.boolean "shotgun_start", default: true
    t.string "signature_image_url_override"
    t.integer "slope_rating"
    t.string "slug"
    t.datetime "sponsor_edit_deadline"
    t.string "start_time"
    t.string "status", default: "draft", null: false
    t.string "swipe_simple_url"
    t.integer "team_size", default: 4
    t.string "tee_name"
    t.integer "tee_time_interval_minutes", default: 10
    t.boolean "tee_times_enabled", default: false
    t.string "theme_preset", default: "classic", null: false
    t.integer "total_holes", default: 18
    t.integer "total_par"
    t.string "tournament_format", default: "scramble"
    t.text "tournament_info"
    t.datetime "updated_at", null: false
    t.boolean "use_flights", default: false
    t.boolean "use_org_branding", default: true, null: false
    t.boolean "waitlist_enabled", default: true
    t.integer "waitlist_max"
    t.integer "walkin_fee"
    t.boolean "walkin_registration_open", default: false
    t.string "walkin_swipe_simple_url"
    t.integer "year", null: false
    t.index ["early_bird_deadline"], name: "index_tournaments_on_early_bird_deadline"
    t.index ["event_type"], name: "index_tournaments_on_event_type"
    t.index ["organization_id", "slug"], name: "index_tournaments_on_organization_id_and_slug", unique: true
    t.index ["organization_id"], name: "index_tournaments_on_organization_id"
    t.index ["public_listed"], name: "index_tournaments_on_public_listed"
    t.index ["registration_deadline"], name: "index_tournaments_on_registration_deadline"
    t.index ["status", "year"], name: "index_tournaments_on_status_and_year"
    t.index ["status"], name: "index_tournaments_on_status"
    t.index ["tournament_format"], name: "index_tournaments_on_tournament_format"
    t.index ["year"], name: "index_tournaments_on_year"
  end

  create_table "users", force: :cascade do |t|
    t.string "clerk_id"
    t.datetime "created_at", null: false
    t.string "email"
    t.string "name"
    t.string "role", default: "org_admin"
    t.datetime "updated_at", null: false
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "activity_logs", "tournaments"
  add_foreign_key "activity_logs", "users", column: "admin_id"
  add_foreign_key "golfers", "groups"
  add_foreign_key "golfers", "sponsors"
  add_foreign_key "golfers", "tournaments"
  add_foreign_key "golfers", "users", column: "refunded_by_id", on_delete: :nullify
  add_foreign_key "groups", "tournaments"
  add_foreign_key "organization_memberships", "organizations"
  add_foreign_key "organization_memberships", "users"
  add_foreign_key "raffle_prizes", "raffle_tickets", column: "winning_ticket_id"
  add_foreign_key "raffle_prizes", "tournaments"
  add_foreign_key "raffle_sale_batches", "tournaments"
  add_foreign_key "raffle_sale_batches", "users", column: "sold_by_user_id"
  add_foreign_key "raffle_tickets", "golfers"
  add_foreign_key "raffle_tickets", "raffle_prizes"
  add_foreign_key "raffle_tickets", "raffle_sale_batches"
  add_foreign_key "raffle_tickets", "tournaments"
  add_foreign_key "scores", "golfers"
  add_foreign_key "scores", "groups"
  add_foreign_key "scores", "tournaments"
  add_foreign_key "scores", "users", column: "entered_by_id"
  add_foreign_key "sponsor_slots", "sponsors"
  add_foreign_key "sponsor_slots", "tournaments"
  add_foreign_key "sponsors", "tournaments"
  add_foreign_key "tournament_assignments", "tournaments"
  add_foreign_key "tournament_assignments", "users"
  add_foreign_key "tournaments", "organizations"
end
