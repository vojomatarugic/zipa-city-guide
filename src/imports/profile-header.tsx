<div className="flex items-start gap-4">
            {/* PROFILE IMAGE AVATAR WITH +/X (ONLY IN EDIT MODE) */}
            <div className="relative w-16 h-16 flex-shrink-0">
              {/* Hidden file input */}
              <input
                type="file"
                id="profile-image-upload-main"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              
              {/* Avatar Circle */}
              {imagePreview ? (
                <>
                  {/* Image */}
                  <img
                    src={imagePreview}
                    alt="Profile"
                    className="w-16 h-16 rounded-full object-cover"
                    style={{
                      border: '2px solid #0E3DC5'
                    }}
                  />
                  {/* X Button - Top Right (ONLY IN EDIT MODE) */}
                  {isEditingProfile && (
                    <button
                      onClick={() => {
                        setImagePreview('');
                        setSelectedFile(null);
                        setEditProfileImage('');
                      }}
                      className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all shadow-lg"
                      style={{ cursor: 'pointer' }}
                      type="button"
                    >
                      <X size={12} />
                    </button>
                  )}
                </>
              ) : (
                <>
                  {/* Placeholder with User Icon */}
                  <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center"
                    style={{
                      border: '2px solid #0E3DC5'
                    }}
                  >
                    <User size={32} className="text-[#0E3DC5]" />
                  </div>
                  {/* + Button - Bottom Right (ONLY IN EDIT MODE) */}
                  {isEditingProfile && (
                    <button
                      onClick={() => document.getElementById('profile-image-upload-main')?.click()}
                      className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center hover:bg-gray-800 transition-all shadow-lg"
                      style={{ cursor: 'pointer' }}
                      type="button"
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? (
                        <span className="text-[12px]">⏳</span>
                      ) : (
                        <span className="text-[14px] font-bold leading-none">+</span>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* TITLE & PROFILE INFO */}
            <div className="flex-1">
              {!isEditingProfile ? (
                <>
                  <h1
                    style={{
                      fontSize: '32px',
                      fontWeight: 700,
                      color: TEXT.primary,
                      marginBottom: '4px'
                    }}
                  >
                    {t('myPanel')}
                  </h1>
                  <p
                    style={{
                      fontSize: '16px',
                      color: TEXT.secondary,
                      marginBottom: '2px'
                    }}
                  >
                    {user.name || user.email}
                  </p>
                  <p className="text-[14px] mb-1" style={{ color: TEXT.secondary }}>
                    {user.email}
                  </p>
                  {user.phone && (
                    <p className="text-[14px] mb-2" style={{ color: TEXT.secondary }}>
                      📱 {user.phone}
                    </p>
                  )}
                  {!user.phone && <div className="mb-2"></div>}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsEditingProfile(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-[14px] font-semibold hover:bg-gray-200 transition-all"
                      style={{ cursor: 'pointer' }}
                    >
                      <Edit2 size={16} />
                      {t('editProfile')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h1
                    style={{
                      fontSize: '32px',
                      fontWeight: 700,
                      color: TEXT.primary,
                      marginBottom: '12px'
                    }}
                  >
                    {t('editProfile')}
                  </h1>

                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block text-[13px] font-semibold mb-1" style={{ color: TEXT.secondary }}>
                        {t('profileName')}
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[14px]"
                        placeholder={t('profileName')}
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold mb-1" style={{ color: TEXT.secondary }}>
                        {t('profileEmail')}
                      </label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[14px]"
                        placeholder={t('profileEmail')}
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold mb-1" style={{ color: TEXT.secondary }}>
                        {t('profilePhone')}
                      </label>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => {
                          setEditPhone(e.target.value);
                          if (phoneError) setPhoneError('');
                        }}
                        className="w-full px-3 py-2 rounded-lg text-[14px]"
                        style={{
                          border: `1px solid ${phoneError ? '#DC2626' : '#D1D5DB'}`,
                        }}
                        placeholder={t('profilePhone')}
                      />
                      {phoneError && (
                        <p className="text-[12px] mt-1" style={{ color: '#DC2626' }}>{phoneError}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={async () => {
                        try {
                          // Validate phone number - REQUIRED
                          const digitsOnly = editPhone.replace(/\D/g, '');
                          if (!editPhone.trim() || digitsOnly.length < 9) {
                            setPhoneError(
                              language === 'sr'
                                ? 'Broj telefona mora imati najmanje 9 cifara (npr. 065 123 456 ili +387 65 123 456)'
                                : 'Phone number must have at least 9 digits (e.g. 065 123 456 or +387 65 123 456)'
                            );
                            return;
                          }
                          if (digitsOnly.length > 15) {
                            setPhoneError(
                              language === 'sr'
                                ? 'Broj telefona ne može imati više od 15 cifara'
                                : 'Phone number cannot have more than 15 digits'
                            );
                            return;
                          }

                          setUploadingImage(true);
                          let finalProfileImageUrl = editProfileImage;
                          
                          // If there's a new file selected, upload it first
                          if (selectedFile && user) {
                            console.log('📤 Uploading new profile image...');
                            const formData = new FormData();
                            formData.append('file', selectedFile);
                            formData.append('userId', user.id);
                            
                            const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-ee0c365c/upload/profile-image`, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${publicAnonKey}`,
                              },
                              body: formData,
                            });
                            
                            if (!response.ok) {
                              const errorData = await response.json();
                              throw new Error(errorData.error || 'Failed to upload image');
                            }
                            
                            const data = await response.json();
                            finalProfileImageUrl = data.url;
                            console.log('✅ Image uploaded:', finalProfileImageUrl);
                          }
                          
                          // Now save profile with the uploaded image URL
                          console.log('💾 Saving profile:', { name: editName, email: editEmail, phone: editPhone, profileImage: finalProfileImageUrl });
                          await updateProfile(editName, editEmail, editPhone, finalProfileImageUrl);
                          
                          // Reset state
                          setSelectedFile(null);
                          setIsEditingProfile(false);
                          setUploadingImage(false);
                          
                          toast.success(t('profileSaved'));
                        } catch (error) {
                          console.error('❌ Error saving profile:', error);
                          setUploadingImage(false);
                          toast.error(t('profileSaveError'));
                        }
                      }}
                      className="px-4 py-2 bg-[#0E3DC5] text-white rounded-lg text-[14px] font-semibold hover:bg-[#0a2d94]"
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? `⏳ ${t('saving')}` : t('save')}
                    </button>
                    <button
                      onClick={() => {
                        setEditName(user?.name || '');
                        setEditEmail(user?.email || '');
                        setEditPhone(user?.phone || '');
                        setEditProfileImage(user?.profileImage || '');
                        setImagePreview(user?.profileImage || '');
                        setSelectedFile(null);
                        setIsEditingProfile(false);
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-[14px] font-semibold hover:bg-gray-200"
                      disabled={uploadingImage}
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>