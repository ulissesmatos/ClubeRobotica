import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const WHATSAPP_NUMBER = "559998881234";

const turmas = [
  {
    title: "Fundamental I",
    turno: "Manhã",
    subtitle: "1º ao 5º Ano • Matutino",
    description:
      "Inicie sua jornada na robótica com atividades divertidas e criativas!",
    message:
      "Olá! Gostaria de me inscrever na turma Fundamental I (Manhã) do Clubinho de Robótica!",
  },
  {
    title: "Fundamental I",
    turno: "Tarde",
    subtitle: "1º ao 5º Ano • Vespertino",
    description:
      "Divirta-se criando robôs e explorando a tecnologia à tarde!",
    message:
      "Olá! Gostaria de me inscrever na turma Fundamental I (Tarde) do Clubinho de Robótica!",
  },
  {
    title: "Fundamental II",
    turno: "Tarde",
    subtitle: "6º ao 9º Ano • Vespertino",
    description:
      "Desenvolva lógica de programação e construa projetos reais!",
    message:
      "Olá! Gostaria de me inscrever na turma Fundamental II (Tarde) do Clubinho de Robótica!",
  },
  {
    title: "Fundamental II",
    turno: "Tarde - Avançado",
    subtitle: "6º ao 9º Ano • Vespertino",
    description:
      "Desafios avançados, projetos complexos e competições de robótica!",
    message:
      "Olá! Gostaria de me inscrever na turma Fundamental II (Avançado) do Clubinho de Robótica!",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: "easeOut" },
  }),
};

const TurmasSection = () => {
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
            Escolha sua Turma e Inscreva-se
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Temos turmas para todos os níveis! Escolha a ideal e comece sua
            jornada na robótica.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {turmas.map((turma, i) => (
            <motion.div
              key={`${turma.title}-${turma.turno}`}
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
                  {turma.title}
                </h3>
                <span className="text-sm font-bold text-primary mb-1">
                  ({turma.turno})
                </span>
                <p className="text-xs text-muted-foreground font-semibold mb-3">
                  {turma.subtitle}
                </p>
                <p className="text-sm text-muted-foreground mb-5 flex-1">
                  {turma.description}
                </p>
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(turma.message)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="w-full rounded-full font-bold text-sm">
                    Inscrever-se
                  </Button>
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TurmasSection;
