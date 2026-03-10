export interface SiteSettings {
  whatsapp_number: string;
  whatsapp_message: string;
  whatsapp_floating_enabled: string;
  whatsapp_footer_enabled: string;
  instagram_handle: string;
  instagram_enabled: string;
  phone_display: string;
  phone_number: string;
  phone_enabled: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  whatsapp_number: "559998881234",
  whatsapp_message:
    "Olá! Tenho interesse no Clubinho de Robótica de Codó. Pode me dar mais informações?",
  whatsapp_floating_enabled: "1",
  whatsapp_footer_enabled: "1",
  instagram_handle: "clubinhorobotica_codo",
  instagram_enabled: "1",
  phone_display: "(99) 98888-1234",
  phone_number: "559998881234",
  phone_enabled: "1",
};

export async function fetchPublicSettings(): Promise<SiteSettings> {
  const res = await fetch("/api/settings");
  if (!res.ok) throw new Error("Erro ao carregar configurações.");
  return res.json();
}
