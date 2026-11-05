-- Page 17 text send. V1 and V2 stay as applied.
-- payload and edited_at stay absent until edit/image/card writes need them.
-- The unique key is the sender plus the client id, including across rooms.

ALTER TABLE chat_messages
    ADD COLUMN client_message_id varchar(36);

CREATE UNIQUE INDEX chat_messages_sender_client_uk
    ON chat_messages (sender_id, client_message_id)
    WHERE client_message_id IS NOT NULL;
