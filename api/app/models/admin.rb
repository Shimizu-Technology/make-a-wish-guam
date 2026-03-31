# frozen_string_literal: true

# Backwards-compatible alias for legacy code paths/tests that still reference Admin.
# The canonical model is User.
class Admin < User
end
