module PhoneHelper
  # Format phone number to +1 (XXX) XXX-XXXX format
  def format_phone(phone)
    return phone if phone.blank?
    
    # Remove all non-digits
    digits = phone.gsub(/\D/, '')
    
    # Remove leading 1 if present and we have more than 10 digits
    digits = digits[1..] if digits.start_with?('1') && digits.length > 10
    
    # Return original if not enough digits for full formatting
    return phone if digits.length < 7
    
    # If we have 10 digits, format fully
    if digits.length >= 10
      digits = digits[-10..]
      "+1 (#{digits[0..2]}) #{digits[3..5]}-#{digits[6..9]}"
    elsif digits.length >= 7
      # Format with what we have
      "+1 (#{digits[0..2]}) #{digits[3..5]}-#{digits[6..]}"
    else
      phone
    end
  end
end

