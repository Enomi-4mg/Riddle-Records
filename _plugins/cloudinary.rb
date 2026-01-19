module CloudinaryFilter
  def cloudinary_url(cloudinary_id)
    return '' if cloudinary_id.nil? || cloudinary_id.empty?
    
    # Get Cloudinary settings from site config
    cloud_name = @context.registers[:site].config['cloudinary_cloud_name']
    
    return '' if cloud_name.nil?
    
    "https://res.cloudinary.com/#{cloud_name}/image/upload/#{cloudinary_id}"
  end
end

Liquid::Template.register_filter(CloudinaryFilter)
