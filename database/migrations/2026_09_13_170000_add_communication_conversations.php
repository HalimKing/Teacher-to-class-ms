<?php

use App\Models\Communication;
use App\Models\CommunicationConversation;
use App\Models\CommunicationConversationParticipant;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('communication_conversations', function (Blueprint $table) {
            $table->id();
            $table->string('subject');
            $table->nullableMorphs('started_by');
            $table->unsignedInteger('message_count')->default(0);
            $table->text('last_message_preview')->nullable();
            $table->timestamp('last_message_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('communication_conversation_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('communication_conversations')->cascadeOnDelete();
            $table->morphs('participant');
            $table->timestamp('last_read_at')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->unique(
                ['conversation_id', 'participant_type', 'participant_id'],
                'comm_conv_participant_unique'
            );
        });

        Schema::table('communications', function (Blueprint $table) {
            $table->foreignId('conversation_id')
                ->nullable()
                ->after('id')
                ->constrained('communication_conversations')
                ->nullOnDelete();
            $table->foreignId('parent_id')
                ->nullable()
                ->after('conversation_id')
                ->constrained('communications')
                ->nullOnDelete();
            $table->string('kind', 20)->default('original')->after('parent_id');
        });

        Schema::table('communication_recipients', function (Blueprint $table) {
            $table->unsignedBigInteger('teacher_id')->nullable()->change();
            $table->foreignId('user_id')
                ->nullable()
                ->after('teacher_id')
                ->constrained('users')
                ->nullOnDelete();
        });

        $this->backfillConversations();
    }

    public function down(): void
    {
        Schema::table('communication_recipients', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
        });

        Schema::table('communications', function (Blueprint $table) {
            $table->dropConstrainedForeignId('conversation_id');
            $table->dropConstrainedForeignId('parent_id');
            $table->dropColumn('kind');
        });

        Schema::dropIfExists('communication_conversation_participants');
        Schema::dropIfExists('communication_conversations');
    }

    private function backfillConversations(): void
    {
        Communication::query()
            ->with(['recipients', 'sender'])
            ->orderBy('id')
            ->each(function (Communication $message): void {
                $preview = trim(preg_replace('/\s+/', ' ', strip_tags((string) $message->body)) ?? '');
                if (strlen($preview) > 179) {
                    $preview = rtrim(substr($preview, 0, 179)).'…';
                }

                $conversation = CommunicationConversation::query()->create([
                    'subject' => $message->subject,
                    'started_by_type' => $message->sender_type,
                    'started_by_id' => $message->sender_id,
                    'message_count' => $message->status === Communication::STATUS_DRAFT ? 0 : 1,
                    'last_message_preview' => $preview !== '' ? $preview : null,
                    'last_message_at' => $message->sent_at ?? $message->created_at ?? now(),
                ]);

                $message->forceFill([
                    'conversation_id' => $conversation->id,
                    'kind' => 'original',
                ])->save();

                $this->addParticipant($conversation, $message->sender_type, (int) $message->sender_id, $message->sent_at ?? $message->created_at);

                foreach ($message->recipients as $recipient) {
                    if ($recipient->teacher_id) {
                        $this->addParticipant($conversation, Teacher::class, (int) $recipient->teacher_id, $recipient->read_at);
                    }

                    if ($recipient->user_id) {
                        $this->addParticipant($conversation, User::class, (int) $recipient->user_id, $recipient->read_at);
                    }
                }
            });
    }

    private function addParticipant(
        CommunicationConversation $conversation,
        ?string $type,
        int $id,
        mixed $lastReadAt = null,
    ): void {
        if (! $type || $id < 1) {
            return;
        }

        CommunicationConversationParticipant::query()->firstOrCreate(
            [
                'conversation_id' => $conversation->id,
                'participant_type' => $type,
                'participant_id' => $id,
            ],
            [
                'last_read_at' => $lastReadAt,
            ],
        );
    }
};
