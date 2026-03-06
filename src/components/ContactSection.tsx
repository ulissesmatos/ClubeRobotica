import { motion } from "framer-motion";
import { Instagram, Phone, MapPin, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

const WHATSAPP_NUMBER = "559998881234";
const WHATSAPP_MESSAGE =
  "Olá! Tenho interesse no Clubinho de Robótica de Codó. Pode me dar mais informações?";

const ContactSection = () => {
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
          <a
            href="https://instagram.com/clubinhorobotica_codo"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:text-secondary transition-colors font-semibold"
          >
            <Instagram className="w-5 h-5" />
            @clubinhorobotica_codo
          </a>
          <a
            href="tel:+559998881234"
            className="flex items-center gap-2 hover:text-secondary transition-colors font-semibold"
          >
            <Phone className="w-5 h-5" />
            (99) 98888-1234
          </a>
          <span className="flex items-center gap-2 font-semibold">
            <MapPin className="w-5 h-5" />
            Codó, MA
          </span>
        </div>

        {/* WhatsApp CTA */}
        <div className="flex justify-center mb-12">
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="bg-green-500 hover:bg-green-600 text-white font-bold px-8 h-12 rounded-full text-base shadow-lg">
              Falar pelo WhatsApp
            </Button>
          </a>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-navy-foreground/20 pt-6 text-center">
          <p className="text-navy-foreground/45 text-sm flex items-center justify-center gap-1.5">
            © 2026 Clubinho de Robótica — Feito com{" "}
            <Heart className="w-4 h-4 text-secondary fill-secondary inline" />{" "}
            em Codó, MA
          </p>
        </div>
      </div>
    </footer>
  );
};

export default ContactSection;
