import { motion } from "framer-motion";
import { Instagram, Phone, MapPin, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import logosCodomSemecti from "@/assets/codó_e_semecti.webp";
import { useSettings } from "@/context/SettingsContext";

const ContactSection = () => {
  const settings = useSettings();
  const waNumber = settings.whatsapp_number;
  const waMessage = settings.whatsapp_message;
  const showWaFooter = settings.whatsapp_footer_enabled === "1";
  const showInstagram = settings.instagram_enabled === "1";
  const showPhone = settings.phone_enabled === "1";

  return (
    <footer id="contato" className="bg-navy py-16">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl md:text-3xl font-extrabold text-navy-foreground mb-2 font-display">
            Entre em Contato
          </h2>
          <p className="text-navy-foreground/65 text-base max-w-md mx-auto">
            Ficou com dúvidas? Fale com a gente! Estamos prontos para ajudar.
          </p>
        </motion.div>

        {/* Contact links */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-navy-foreground/85 mb-8 flex-wrap">
          {showInstagram && (
            <a
              href={`https://instagram.com/${settings.instagram_handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-secondary transition-colors font-semibold"
            >
              <Instagram className="w-5 h-5" />
              @{settings.instagram_handle}
            </a>
          )}
          {showPhone && (
            <a
              href={`tel:+${settings.phone_number}`}
              className="flex items-center gap-2 hover:text-secondary transition-colors font-semibold"
            >
              <Phone className="w-5 h-5" />
              {settings.phone_display}
            </a>
          )}
          <span className="flex items-center gap-2 font-semibold">
            <MapPin className="w-5 h-5" />
            Codó, MA
          </span>
        </div>

        {/* WhatsApp CTA */}
        {showWaFooter && (
          <div className="flex justify-center mb-12">
            <a
              href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="bg-green-500 hover:bg-green-600 text-white font-bold px-8 h-12 rounded-full text-base shadow-lg">
                Falar pelo WhatsApp
              </Button>
            </a>
          </div>
        )}

        {/* Bottom bar */}
        <div className="border-t border-navy-foreground/20 pt-6 text-center">
          {/* Logos realizacao */}
          <div className="flex flex-col items-center gap-1.5 mb-5">
            <span className="text-navy-foreground/40 text-xs font-semibold uppercase tracking-widest">Realização</span>
            <a href="https://codo.ma.gov.br/" target="_blank" rel="noopener noreferrer" className="bg-white rounded-xl px-4 py-2 shadow-sm inline-block">
              <img
                src={logosCodomSemecti}
                alt="Prefeitura de Codó e SEMECTI"
                className="h-9 w-auto object-contain"
              />
            </a>
          </div>
          <p className="text-navy-foreground/45 text-sm flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 leading-relaxed">
            <span>© 2026 Clubinho de Robótica</span>
            <span>— Feito com</span>
            <Heart className="w-4 h-4 text-secondary fill-secondary shrink-0" />
            <span>em Codó, MA</span>
          </p>
          <p className="mt-3">
            <a
              href="/admin/login"
              className="text-navy-foreground/25 text-xs hover:text-navy-foreground/50 transition-colors"
            >
              Área Restrita
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default ContactSection;
