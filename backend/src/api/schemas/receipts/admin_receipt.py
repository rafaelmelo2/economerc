from api.schemas.receipts.receipt import ReceiptResponse


class AdminReceiptResponse(ReceiptResponse):
    """`ReceiptResponse` + o que a fila de moderação precisa mostrar sem outra chamada."""

    user_email: str | None
    market_name: str | None
