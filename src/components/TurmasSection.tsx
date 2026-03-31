import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { fetchActiveForms, ActiveForm } from "@/api/forms";
import { FileText, CalendarDays } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";

function deriveCardConfig(title: string) {
  const isFII = /fundamental ii/i.test(title);
  const isTarde = /tarde/i.test(title);
  const isAvancada = /avançada/i.test(title);

  const level = isFII ? "Fundamental II" : "Fundamental I";
  const yearRange = isFII ? "6º ao 9º Ano" : "3º ao 5º Ano";

  let turno: string;
  let period: string;
  let description: string;

  if (!isTarde) {
    turno = "Manhã";
    period = "Matutino";
    description = isFII
      ? "Desenvolva lógica de programação e construa projetos reais!"
      : "Inicie sua jornada na robótica com atividades divertidas e criativas!";
  } else if (isAvancada) {
    turno = "Tarde Avançada";
    period = "Vespertino";
    description = "Desafios avançados, projetos complexos e competições de robótica!";
  } else {
    turno = "Tarde";
    period = "Vespertino";
    description = isFII
      ? "Desenvolva projetos avançados de robótica à tarde!"
      : "Divirta-se criando robôs e explorando a tecnologia à tarde!";
  }

  return { level, turno, subtitle: `${yearRange} • ${period}`, description };
}

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: "easeOut" },
  }),
};

const TurmasSection = () => {
  const [forms, setForms] = useState<ActiveForm[]>([]);
  const [loading, setLoading] = useState(true);
  const { enrollments_status, enrollments_date_start, enrollments_date_end } = useSettings();
  const isClosed = enrollments_status === "closed";
  const isExtended = enrollments_status === "extended";
  const dateRange = `${enrollments_date_start || "24/03"} a ${enrollments_date_end || "30/03"}`;

  useEffect(() => {
    fetchActiveForms()
      .then(setForms)
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="turmas" className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-block bg-primary/10 text-primary px-4 py-1 rounded-full text-sm font-bold mb-3">
            🎓 Nossas Turmas
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-3 font-display">
            {isClosed
              ? "Inscrições Encerradas"
              : isExtended
              ? "Inscrições Prorrogadas — Escolha sua Turma!"
              : "Escolha sua Turma!"}
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            {isClosed
              ? "As inscrições foram encerradas. Fique atento para a próxima edição!"
              : isExtended
              ? `As inscrições foram prorrogadas! Escolha a turma ideal e garanta sua vaga até ${enrollments_date_end || "30/03"}.`
              : "Vagas limitadas! Garanta sua vaga e escolha a turma ideal."}
          </p>

          {/* Info bar: edital + datas */}
          {!isClosed && (
            <div className="mt-6 inline-flex flex-col sm:flex-row items-center gap-4 bg-primary/5 border border-primary/20 rounded-2xl px-6 py-3">
              <div className="flex items-center gap-2 text-foreground text-sm font-semibold">
                <CalendarDays className="w-4 h-4 text-primary" />
                <span>Inscrições: <strong>{dateRange}</strong></span>
              </div>
              <span className="hidden sm:block text-border">|</span>
              <a
                href="https://codo.ma.gov.br/seletivo-17"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-primary hover:text-primary/80 text-sm font-bold transition-colors"
              >
                <FileText className="w-4 h-4" />
                Ler o Edital Completo
              </a>
            </div>
          )}
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-2xl shadow-md border border-border h-52 animate-pulse"
              />
            ))}
          </div>
        ) : forms.length === 0 ? (
          <p className="text-center text-muted-foreground text-lg">
            Novidades em breve!
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {forms.map((form, i) => {
              const derived = deriveCardConfig(form.title);
              const level       = form.card_level    ?? derived.level;
              const turno       = form.card_turno    ?? derived.turno;
              const subtitle    = form.card_subtitle ?? derived.subtitle;
              const description = form.description   ?? derived.description;
              return (
                <motion.div
                  key={form.id}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={cardVariants}
                  whileHover={{ y: -6, scale: 1.02 }}
                  className="bg-card rounded-2xl shadow-md border border-border overflow-hidden flex flex-col transition-shadow hover:shadow-xl"
                >
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-lg font-extrabold text-foreground font-display">
                      {level}
                    </h3>
                    <span className="text-sm font-bold text-primary mb-1">
                      ({turno})
                    </span>
                    <p className="text-xs text-muted-foreground font-semibold mb-3">
                      {subtitle}
                    </p>
                    <p className="text-sm text-muted-foreground mb-5 flex-1">
                      {description}
                    </p>
                    <Link to={`/inscricao/${form.slug}`} aria-disabled={isClosed} tabIndex={isClosed ? -1 : undefined}>
                      <Button
                        className="w-full rounded-full font-bold text-sm"
                        disabled={isClosed}
                      >
                        {isClosed ? "Encerrado" : "Inscrever-se"}
                      </Button>
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default TurmasSection;
