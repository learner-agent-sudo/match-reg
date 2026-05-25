"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface PaymentUploadProps {
  teamId: string;
  currentStatus: string;
  onStatusChange: (status: string) => void;
}

export default function PaymentUpload({ teamId, currentStatus, onStatusChange }: PaymentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    const supabase = createClient();
    const fileExt = file.name.split(".").pop();
    const filePath = `${teamId}/payment-proof.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("payment-proofs")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("payment-proofs")
      .getPublicUrl(filePath);

    await supabase
      .from("teams")
      .update({ payment_status: "submitted", payment_proof_url: publicUrl })
      .eq("id", teamId);

    onStatusChange("submitted");
    setUploading(false);
  };

  if (currentStatus === "confirmed") {
    return (
      <div className="p-3 bg-green-900/30 border border-green-700 rounded-md">
        <p className="text-sm text-green-400 font-medium">Payment confirmed</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-700/50 border border-slate-600 rounded-md">
      <p className="text-sm font-medium text-slate-300 mb-2">
        {currentStatus === "submitted"
          ? "Payment proof submitted — awaiting confirmation"
          : "Upload payment screenshot"}
      </p>
      <input
        type="file"
        accept="image/*"
        onChange={handleUpload}
        disabled={uploading}
        className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-500"
      />
      {uploading && <p className="text-xs text-slate-400 mt-1">Uploading...</p>}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
