from . import constants

APP_TITLE = "Hệ thống hỗ trợ cảm xúc"
APP_TAGLINE = "Người bạn đồng hành lắng nghe và gợi ý kỹ năng giảm căng thẳng"

DISCLAIMER_VI = """
**Trước khi bắt đầu, bạn đọc giúp mình phần này nhé**

- Mình là một chatbot đồng hành, **không phải công cụ chẩn đoán y tế**.
- Kết quả bài đánh giá chỉ mang tính tham khảo, **không phải kết luận bệnh**.
- Mình **không thay thế** bác sĩ, nhà tâm lý hay chuyên gia sức khỏe tâm thần.
- Nếu bạn **không đăng nhập**, cuộc trò chuyện chỉ nằm trong phiên làm việc
  này và sẽ mất khi bạn đóng tab.
- Nếu bạn **đăng nhập và đồng ý**, các lượt trò chuyện được lưu lại để bạn xem
  lại sau. Số điện thoại, email và số căn cước được che trước khi lưu, và bạn
  xoá được bất cứ lúc nào.
- Nếu bạn đang trong tình huống nguy hiểm, hãy gọi **115** ngay.
"""

DISCLAIMER_ACK_LABEL = "Mình đã đọc và hiểu, bắt đầu trò chuyện"

GREETING_VI = (
    "Chào bạn, mình là Hệ thống hỗ trợ cảm xúc. Dạo này bạn thế nào? "
    "Bạn có thể kể bất cứ điều gì đang ở trong đầu, mình nghe."
)

CONSENT_PROMPT_VI = (
    "Mình có một bộ 10 câu hỏi ngắn theo thang đo chuẩn quốc tế, giúp mình "
    "hiểu rõ hơn tình trạng của bạn. Bạn muốn thử không? Có thể dừng bất cứ "
    "lúc nào."
)

CONSENT_YES_LABEL = "Có, mình muốn thử"
CONSENT_NO_LABEL = "Chưa, mình muốn nói tiếp"
ASSESSMENT_STOP_LABEL = "Dừng lại"
ASSESSMENT_NEXT_LABEL = "Tiếp tục"

ASSESSMENT_STOPPED_VI = (
    "Mình dừng bài đánh giá ở đây nhé, không sao cả. Bạn muốn kể tiếp điều gì "
    "đang làm bạn mệt không?"
)

CONSENT_DECLINED_VI = (
    "Không vấn đề gì. Mình vẫn ở đây nghe bạn. Khi nào muốn thử bài đánh giá, "
    'bạn chỉ cần gõ "đánh giá" là mình mở lên.'
)

LEVEL_TITLES_VI = {
    constants.LEVEL_LOW: "Căng thẳng thấp",
    constants.LEVEL_MEDIUM: "Căng thẳng trung bình",
    constants.LEVEL_HIGH: "Căng thẳng cao",
}

LEVEL_EXPLANATION_VI = {
    constants.LEVEL_LOW: (
        "Mức này cho thấy trong tháng qua bạn phần lớn vẫn cảm thấy mình xoay "
        "xở được với những gì xảy ra. Điều đó không có nghĩa là bạn không có "
        "lúc mệt, mà là bạn đang có sẵn một số nguồn lực để dựa vào."
    ),
    constants.LEVEL_MEDIUM: (
        "Mức này cho thấy căng thẳng đang hiện diện khá rõ và có lúc vượt quá "
        "khả năng xoay xở của bạn. Đây là thời điểm tốt để luyện vài kỹ năng "
        "nhỏ mỗi ngày, trước khi mọi thứ dồn lại."
    ),
    constants.LEVEL_HIGH: (
        "Mức này cho thấy bạn đang chịu nhiều căng thẳng, và có thể cảm giác "
        "khó kiểm soát đang lấn át. Ngoài các bài tập tự chăm sóc, mình rất "
        "mong bạn cân nhắc tìm thêm hỗ trợ từ người có chuyên môn."
    ),
}

SCRIPTED_REPLIES_VI = (
    (
        ("ổn", "bình thường", "không có gì", "xem thử", "ghé xem", "tìm hiểu"),
        "Vậy thì tốt rồi. Bạn cứ thoải mái xem quanh, khi nào muốn kể gì thì "
        "mình nghe.",
    ),
    (
        ("vui", "hạnh phúc", "nhẹ người", "thoải mái", "xong rồi", "đỡ hơn"),
        "Nghe tin đó cũng thấy nhẹ theo. Chúc bạn giữ được cảm giác này thêm "
        "một chút nữa.",
    ),
    (
        ("cảm ơn", "cám ơn", "hiểu rồi", "được rồi", "ok"),
        "Không có gì đâu. Mình vẫn ở đây nếu bạn cần.",
    ),
    (
        ("học", "thi", "deadline", "bài tập", "điểm", "trường"),
        "Việc học dồn lại thì dễ khiến đầu mình lúc nào cũng căng. Bạn kể mình "
        "nghe cụ thể phần nào đang nặng nhất với bạn?",
    ),
    (
        ("ngủ", "mất ngủ", "thức", "mệt mỏi", "kiệt sức"),
        "Ngủ không được thì mọi thứ khác cũng khó lên nổi. Chuyện này diễn ra "
        "được bao lâu rồi?",
    ),
    (
        ("cô đơn", "một mình", "không ai", "lạc lõng"),
        "Cảm giác không có ai để dựa vào là một cảm giác rất nặng. Mình đang ở "
        "đây và mình nghe bạn. Điều gì làm bạn thấy như vậy?",
    ),
    (
        ("gia đình", "bố", "mẹ", "ba", "cha", "anh", "chị"),
        "Chuyện trong gia đình thường khó nói ra nhất. Bạn muốn kể thêm một "
        "chút về điều đang xảy ra không?",
    ),
    (
        ("lo", "lo lắng", "bồn chồn", "áp lực", "căng thẳng", "stress"),
        "Nghe như bạn đang phải giữ khá nhiều thứ trong người. Nếu chọn một "
        "điều đang khiến bạn lo nhất, đó là gì?",
    ),
)

SCRIPTED_REPLY_DEFAULT_VI = "Mình đang nghe bạn. Bạn muốn kể thêm gì cũng được."

SKILL_TITLES_VI = {
    "grounding": "Tiếp đất (Grounding)",
    "unhooking": "Tháo móc (Unhooking)",
    "acting_on_values": "Hành động dựa trên giá trị của bạn (Acting on values)",
    "being_kind": "Tử tế (Being kind)",
    "making_room": "Dọn chỗ (Making room)",
}

META_ANSWER_VI = """Mình là **Hệ thống hỗ trợ cảm xúc**, một chatbot đồng hành. Đây là những gì mình làm được:

- **Lắng nghe** bạn kể về những gì đang khiến bạn căng thẳng, không phán xét.
- **Hướng dẫn 5 kỹ năng** giảm căng thẳng, lấy từ tài liệu "Những Việc Cần Làm Khi Căng Thẳng" của WHO: tiếp đất, tháo móc, hành động dựa trên giá trị, dọn chỗ, và tử tế. Mình chỉ trả lời trong phạm vi tài liệu này và luôn dẫn số trang nguồn.
- **Bài đánh giá PSS-10**, thang đo căng thẳng cảm nhận 10 câu theo chuẩn quốc tế, cho bạn điểm tổng và mức độ tham khảo.
- **Đưa số hotline** ngay khi nhận thấy bạn có thể đang trong tình huống nguy hiểm.

Những điều mình **không** làm: không chẩn đoán bệnh, không kê thuốc, không thay thế bác sĩ hay nhà tâm lý, và không trả lời các chủ đề ngoài 5 kỹ năng trên (ví dụ giấc ngủ, dinh dưỡng, thuốc men).

Nếu bạn không đăng nhập thì cuộc trò chuyện chỉ nằm trong phiên này và mất khi bạn đóng tab. Nếu bạn đăng nhập và bấm đồng ý, lịch sử được lưu để bạn xem lại, số điện thoại và email được che trước khi lưu, và bạn xoá được bất cứ lúc nào.

Bạn muốn bắt đầu từ đâu? Kể mình nghe chuyện của bạn, hoặc gõ "đánh giá" để làm bài PSS-10."""

RAG_OUT_OF_SCOPE_MESSAGE_VI = (
    "Xin lỗi bạn, chỗ này mình phải nói thật: mình chỉ được xây dựa trên tài "
    "liệu \"Những Việc Cần Làm Khi Căng Thẳng\" của WHO, gồm 5 kỹ năng là tiếp "
    "đất, tháo móc, hành động dựa trên giá trị, dọn chỗ và tử tế. Câu bạn hỏi "
    "nằm ngoài phạm vi đó, nên mình không trả lời để tránh nói những điều mình "
    "không có cơ sở. Nếu bạn muốn, mình có thể cùng bạn thử một trong các kỹ "
    "năng trên, hoặc bạn nên hỏi người có chuyên môn về chủ đề đó."
)

RAG_CONTEXT_HEADER_VI = "Đoạn trích từ tài liệu WHO:"
RAG_CITATION_PREFIX_VI = "Nguồn: tài liệu WHO"

RAG_ERROR_MESSAGE_VI = (
    "Xin lỗi bạn, mình đang gặp sự cố kỹ thuật nên chưa tra cứu được tài liệu "
    "WHO lúc này. Nguyên nhân có thể là thiếu khóa API, kho vector chưa được "
    "tạo, mất mạng hoặc hết hạn mức gọi. Mình sẽ không trả lời đoán để tránh "
    "nói sai điều không có cơ sở. Bạn thử lại sau giúp mình nhé."
)

PSS10_SKILLS_UNAVAILABLE_VI = (
    "Chưa hiển thị được nội dung 5 kỹ năng vì kho vector chưa sẵn sàng. Hãy "
    "chạy `python3 tools/index_documents.py` để tạo. Điểm và mức độ ở trên vẫn "
    "chính xác vì được chấm hoàn toàn tại chỗ."
)

MAPPING_SUGGESTION_NOTE_VI = (
    "Mình hiểu câu trả lời của bạn là mức **{option}**. Bạn xem giúp mình đúng "
    "chưa nhé, nếu chưa đúng thì bạn chọn lại mức khác. Điểm được tính theo ô "
    "bạn xác nhận, không phải theo mức mình đoán."
)
MAPPING_NO_SUGGESTION_NOTE_VI = (
    "Mình chưa chắc câu trả lời của bạn ứng với mức nào, nên mình không tick "
    "sẵn. Bạn chọn giúp mình mức gần nhất nhé."
)
MAPPING_ANSWER_PLACEHOLDER_VI = "Trả lời bằng lời của bạn, ví dụ: thỉnh thoảng thôi"
MAPPING_SUBMIT_LABEL = "Gửi câu trả lời"
MAPPING_CONFIRM_LABEL = "Xác nhận và tiếp tục"
MAPPING_REDO_LABEL = "Trả lời lại bằng lời"

CRISIS_BLOCK_PLACEHOLDER_VI = (
    "(hệ thống đã dừng luồng trò chuyện và hiển thị cảnh báo kèm các kênh hỗ trợ)"
)

CONSENT_STORAGE_TITLE_VI = "Lưu lại lịch sử trò chuyện?"

CONSENT_STORAGE_BODY_VI = (
    "Nếu bạn đồng ý, các lượt trò chuyện **từ lúc này trở đi** sẽ được lưu vào "
    "tài khoản của bạn để bạn xem lại sau, và để nhóm cải thiện hệ thống.\n\n"
    "- Số điện thoại, email và số căn cước **được che trước khi lưu**.\n"
    "- Chỉ bạn xem được lịch sử của mình.\n"
    "- Bạn có thể xoá toàn bộ lịch sử hoặc xoá tài khoản bất cứ lúc nào.\n"
    "- Nếu không đồng ý, bạn vẫn dùng được đầy đủ, chỉ là không có lịch sử."
)
