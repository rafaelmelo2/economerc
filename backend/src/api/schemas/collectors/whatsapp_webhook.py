"""Shape do evento `messages.upsert` da Evolution API v2 (pesquisado em 26/09/2026 — a
documentação oficial não publica um exemplo completo; confirmado via issues/exemplos da
comunidade). Só os campos que o worker usa — `extra="ignore"` (default Pydantic) descarta o
resto (`instanceId`, `source`, `apikey`, `server_url`, ...) sem quebrar quando a Evolution
adicionar campos novos. Atributos em `snake_case` (convenção do projeto) via `Field(alias=...)`
casando com o `camelCase` original da Evolution."""

from pydantic import BaseModel, ConfigDict, Field

_CAMEL_CASE_ALIAS = ConfigDict(populate_by_name=True)


class WhatsAppMessageKey(BaseModel):
    model_config = _CAMEL_CASE_ALIAS

    remote_jid: str = Field(alias="remoteJid")
    from_me: bool = Field(default=False, alias="fromMe")
    id: str | None = None


class WhatsAppExtendedTextMessage(BaseModel):
    text: str | None = None


class WhatsAppImageMessage(BaseModel):
    caption: str | None = None
    mimetype: str | None = None
    url: str | None = None


class WhatsAppMessageContent(BaseModel):
    model_config = _CAMEL_CASE_ALIAS

    conversation: str | None = None
    extended_text_message: WhatsAppExtendedTextMessage | None = Field(
        default=None, alias="extendedTextMessage"
    )
    image_message: WhatsAppImageMessage | None = Field(default=None, alias="imageMessage")
    # Populado só quando a instância Evolution está configurada com `webhookBase64: true` —
    # sem isso, `imageMessage.url` aponta pro CDN criptografado do WhatsApp (sem chave, não dá
    # pra baixar aqui). Sem base64, o worker cai pro texto/caption só.
    base64: str | None = None


class WhatsAppUpsertData(BaseModel):
    model_config = _CAMEL_CASE_ALIAS

    key: WhatsAppMessageKey
    push_name: str | None = Field(default=None, alias="pushName")
    message: WhatsAppMessageContent | None = None
    message_type: str | None = Field(default=None, alias="messageType")
    message_timestamp: int | None = Field(default=None, alias="messageTimestamp")


class WhatsAppWebhookPayload(BaseModel):
    event: str
    instance: str | None = None
    data: WhatsAppUpsertData


class WhatsAppWebhookAck(BaseModel):
    accepted: bool
