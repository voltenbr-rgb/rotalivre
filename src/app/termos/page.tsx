import LegalPage from "@/components/legal/LegalPage";

export const metadata = { title: "Termos de Uso — RotaLivre" };

export default function Termos() {
  return (
    <LegalPage title="Termos de Uso" updated="19/11/2026">
      <p>
        Estes Termos regem o uso do RotaLivre — Hub do Entregador, plataforma que conecta comércios (lojas) a
        entregadores autônomos. Ao criar uma conta você declara que leu e aceita estes Termos e a Política de Privacidade.
      </p>
      <h2>1. O que o RotaLivre faz</h2>
      <p>
        O RotaLivre é uma ferramenta de intermediação tecnológica: a loja publica um pedido de entrega e os entregadores
        próximos podem aceitá-lo. O RotaLivre não é empregador dos entregadores, não é transportadora e não vende os
        produtos entregues.
      </p>
      <h2>2. Cadastro e conta</h2>
      <ul>
        <li>Você precisa ter 18 anos ou mais e informar dados verdadeiros.</li>
        <li>A conta é pessoal; guarde sua senha. Após 5 tentativas erradas, o acesso fica pausado por 10 minutos.</li>
        <li>Esqueceu a senha? Use “Esqueci minha senha”: o suporte confere e envia uma senha provisória.</li>
      </ul>
      <h2>3. Responsabilidades do entregador</h2>
      <ul>
        <li>Possuir habilitação e documentos exigidos para o veículo usado, e respeitar as leis de trânsito.</li>
        <li>Retirar e entregar o pedido com cuidado e finalizar a entrega com o código de 4 dígitos informado pelo cliente.</li>
        <li>Não usar o app enquanto dirige de forma que coloque a si ou outros em risco.</li>
      </ul>
      <h2>4. Responsabilidades da loja</h2>
      <ul>
        <li>Publicar pedidos reais, com endereço, valor e informações corretas.</li>
        <li>Repassar ao cliente o código de entrega e combinar o pagamento do entregador conforme o valor publicado.</li>
      </ul>
      <h2>5. Condutas proibidas</h2>
      <p>
        Fraudes, pedidos falsos, assédio, conteúdo ofensivo ou ilegal no chat (rádio), uso de conta de terceiros e
        tentativas de burlar a segurança. Nesses casos a conta pode ser bloqueada.
      </p>
      <h2>6. Pagamentos</h2>
      <p>
        Os valores mostrados são combinados entre loja e entregador. Salvo aviso expresso, o RotaLivre não processa
        pagamentos nem cobra comissão nesta versão.
      </p>
      <h2>7. Disponibilidade</h2>
      <p>
        O serviço é oferecido “como está”. Podemos alterar, suspender ou encerrar funções a qualquer momento, e não
        garantimos funcionamento sem interrupções (internet, GPS e notificações dependem do aparelho).
      </p>
      <h2>8. Limitação de responsabilidade</h2>
      <p>
        Na medida permitida pela lei, o RotaLivre não responde por danos, perdas ou atrasos na entrega, nem por acordos
        feitos entre loja, entregador e cliente.
      </p>
      <h2>9. Alterações e contato</h2>
      <p>
        Estes Termos podem ser atualizados; avisaremos no app. Dúvidas: use o suporte dentro do aplicativo. Fica eleito o
        foro da comarca de Corumbá/MS.
      </p>
    </LegalPage>
  );
}
