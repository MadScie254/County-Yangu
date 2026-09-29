import { DashboardLayout } from "@/components/DashboardLayout";
import { User, Mail, Phone, MapPin, Save, Camera } from "lucide-react";
import { useRef, useState, type ChangeEvent, type FormEvent, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { uploadFileToBucket } from "@/lib/mutations";
import { supabase } from "@/lib/supabase";

export default function UserProfile() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, profile, refreshProfile } = useAuth();
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    phone_number: "",
    national_id: "",
    address: ""
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        phone_number: profile.phone_number || "",
        national_id: profile.national_id || "",
        address: profile.address || ""
      });
      setAvatarPreview(profile.avatar_url || null);
    }
  }, [profile]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile?.id) return;
    
    setIsSaving(true);
    setSaveMessage("");

    try {
      let finalAvatarUrl = profile.avatar_url;
      
      if (avatarFile) {
        const { publicUrl } = await uploadFileToBucket(avatarFile, "avatars", `${profile.id}_${Date.now()}`);
        finalAvatarUrl = publicUrl;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          name: formData.name,
          phone_number: formData.phone_number,
          national_id: formData.national_id,
          address: formData.address,
          avatar_url: finalAvatarUrl,
        })
        .eq("id", profile.id);

      if (error) throw error;

      await refreshProfile();
      setSaveMessage("Profile saved successfully to Supabase.");
    } catch (error) {
      console.error(error);
      setSaveMessage("Error saving profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setSaveMessage(`Selected avatar: ${file.name}`);
  };

  return (
    <DashboardLayout role="citizen">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Profile</h2>
          <p className="text-gray-500">Manage your personal information and preferences.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center h-fit">
            <div className="relative inline-block mb-4">
              <label htmlFor="avatar-upload" className="sr-only">Profile photo upload</label>
              <input ref={fileInputRef} id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} aria-hidden="true" tabIndex={-1} title="Profile photo upload" />
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Profile avatar preview"
                  className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-white shadow-sm"
                />
              ) : (
                <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 text-3xl font-bold mx-auto border-4 border-white shadow-sm uppercase">
                  {(profile?.name || "C").slice(0, 2)}
                </div>
              )}
              <button type="button" onClick={handleAvatarClick} aria-label="Change profile photo" title="Change profile photo" className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-md border border-gray-200 text-gray-500 hover:text-emerald-600">
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <h3 className="text-xl font-bold text-gray-900">{profile?.name || "Citizen"}</h3>
            <p className="text-gray-500 text-sm mb-4">Citizen ID: {profile?.national_id || "N/A"}</p>
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
              Verified Citizen
            </div>
            <p className="mt-4 text-xs text-gray-500">Nairobi, Kenya</p>
          </div>

          {/* Edit Form */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Personal Details</h3>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="full-name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input id="full-name" type="text" value={formData.name} onChange={(event) => setFormData(cur => ({ ...cur, name: event.target.value }))} className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" title="Full name" placeholder="Full Name" />
                  </div>
                </div>
                <div>
                  <label htmlFor="national-id" className="block text-sm font-medium text-gray-700 mb-1">National ID</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input id="national-id" type="text" value={formData.national_id} onChange={(event) => setFormData(cur => ({ ...cur, national_id: event.target.value }))} className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" title="National ID" placeholder="12345678" />
                  </div>
                </div>
                <div>
                  <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input id="email-address" type="email" value={user?.email || ""} disabled className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50 opacity-70" title="Email address" />
                  </div>
                </div>
                <div>
                  <label htmlFor="phone-number" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input id="phone-number" type="tel" value={formData.phone_number} onChange={(event) => setFormData((current) => ({ ...current, phone_number: event.target.value }))} className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" title="Phone number" placeholder="0712 345 678" />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="physical-address" className="block text-sm font-medium text-gray-700 mb-1">Physical Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input id="physical-address" type="text" value={formData.address} onChange={(event) => setFormData((current) => ({ ...current, address: event.target.value }))} className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" title="Physical address" placeholder="P.O. Box 12345, Nairobi" />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 flex justify-end">
                <button type="submit" className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors">
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
              {saveMessage && <p className="mt-4 text-sm text-emerald-700">{saveMessage}</p>}
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
