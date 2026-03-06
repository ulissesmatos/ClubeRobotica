import { motion } from "framer-motion";
import { Cpu, Lightbulb, Users, Trophy, Calendar, BookOpen } from "lucide-react";

const features = [
  {
    icon: Cpu,
    title: "Robótica & Eletrônica",
    description:
      "Monte e programe robôs usando componentes reais com acompanhamento de instrutores especializados.",
  },
  {
    icon: Lightbulb,
    title: "Pensamento Criativo",
    description:
      "Desenvolva a capacidade de resolver problemas e o pensamento computacional.",
  },
  {
    icon: Users,
    title: "Trabalho em Equipe",
    description:
      "Projetos colaborativos e desafios em grupo que estimulam a cooperação.",
  },
  {
    icon: Trophy,
    title: "Competições",
    description:
      "Participe de competições regionais e nacionais de robótica.",
  },
  {
    icon: Calendar,
    title: "Horários Flexíveis",
    description:
      "Turmas nos períodos matutino e vespertino para encaixar na sua rotina.",
  },
  {
    icon: BookOpen,
    title: "Material Incluso",
    description:
      "Todo o material e equipamentos são fornecidos pelo clube sem custo adicional.",
  },
];

const AboutSection = () => {
  return (
    <section id="sobre" className="py-20 md:py-28 bg-sky">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-block bg-primary/10 text-primary px-4 py-1 rounded-full text-sm font-bold mb-3">
            🚀 Por que participar?
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-3 font-display">
            O que você vai aprender
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Uma experiência completa de tecnologia para crianças e adolescentes,
            do iniciante ao avançado.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.09, duration: 0.5 }}
              className="bg-card rounded-2xl p-6 shadow-sm border border-border flex gap-4 items-start"
            >
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0">
                <feat.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground mb-1 font-display">
                  {feat.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feat.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
