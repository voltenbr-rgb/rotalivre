import LegalPage from "@/components/legal/LegalPage";

export const metadata = { title: "Política de Privacidade — RotaLivre" };

export default function Privacidade() {
  return (
    <LegalPage title="Política de Privacidade" updated="19/11/2026">
      <p>
        Esta Política explica quais dados pessoais o RotaLivre trata e por quê, de acordo com a Lei Geral de Proteção de
        Dados (Lei 13.709/2018 — LGPD).
      </p>
      <h2>1. Dados que coletamos</h2>
      <ul>
        <li><b>Cadastro:</b> e-mail, senha (guardada de forma criptografada), nome, apelido, tipo de veículo, foto de perfil.</li>
        <li><b>Loja:</b> nome, categoria, endereço e localização do estabelecimento.</li>
        <li><b>Localização (GPS):</b> do entregador enquanto o app está em uso, para mostrar pedidos próximos e permitir que a loja e o cliente acompanhem a entrega.</li>
        <li><b>Pedidos:</b> endereços de retirada e entrega, telefone do cliente quando informado, valores e status.</li>
        <li><b>Rádio (chat):</b> mensagens, áudios e fotos enviados.</li>
        <li><b>Suporte:</b> WhatsApp e mensagem enviados ao pedir ajuda.</li>
      </ul>
      <h2>2. Para que usamos</h2>
      <ul>
        <li>Executar o serviço: ligar lojas a entregadores, rastrear e concluir entregas (base legal: execução de contrato).</li>
        <li>Segurança: impedir acessos indevidos e fraudes (legítimo interesse).</li>
        <li>Notificações push de novos pedidos, quando você autoriza.</li>
      </ul>
      <h2>3. Quanto tempo guardamos</h2>
      <ul>
        <li>Mensagens de áudio e texto do rádio: 24 horas. Fotos do rádio: 2 horas.</li>
        <li>Dados de conta e histórico de entregas: enquanto a conta existir ou pelo prazo exigido por lei.</li>
      </ul>
      <h2>4. Com quem compartilhamos</h2>
      <p>
        Apenas o necessário para a entrega: a loja vê nome, veículo e posição do entregador do seu pedido; o cliente,
        pelo link de acompanhamento, vê o status, o primeiro nome do entregador e sua posição durante a entrega. A
        infraestrutura é hospedada na Cloudflare. Não vendemos seus dados.
      </p>
      <h2>5. Seus direitos</h2>
      <p>
        Você pode pedir acesso, correção, exclusão dos seus dados ou revogar consentimentos (como GPS e notificações,
        desativáveis no aparelho) pelo suporte do app.
      </p>
      <h2>6. Segurança</h2>
      <p>
        Senhas são protegidas com criptografia (PBKDF2), o acesso é feito por sessões seguras e há bloqueio após
        tentativas erradas de senha.
      </p>
      <h2>7. Alterações</h2>
      <p>Esta Política pode mudar; a versão atual estará sempre nesta página.</p>
    </LegalPage>
  );
}
