<?php

namespace App\Support;

class CommunicationPermissions
{
    public const VIEW = 'admin.communication.view';

    public const COMPOSE = 'admin.communication.compose';

    public const SEND = 'admin.communication.send';

    public const SEND_SELECTED_FACULTIES = 'admin.communication.send-selected-faculties';

    public const SEND_ALL_FACULTIES = 'admin.communication.send-all-faculties';

    public const SEND_SELECTED_DEPARTMENTS = 'admin.communication.send-selected-departments';

    public const SEND_ALL_DEPARTMENTS = 'admin.communication.send-all-departments';

    public const SEND_SELECTED_STAFF = 'admin.communication.send-selected-staff';

    public const SEND_ALL_STAFF = 'admin.communication.send-all-staff';

    public const VIEW_SENT = 'admin.communication.view-sent';

    public const VIEW_DETAILS = 'admin.communication.view-details';

    public const MANAGE_DRAFTS = 'admin.communication.manage-drafts';

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            self::VIEW,
            self::COMPOSE,
            self::SEND,
            self::SEND_SELECTED_FACULTIES,
            self::SEND_ALL_FACULTIES,
            self::SEND_SELECTED_DEPARTMENTS,
            self::SEND_ALL_DEPARTMENTS,
            self::SEND_SELECTED_STAFF,
            self::SEND_ALL_STAFF,
            self::VIEW_SENT,
            self::VIEW_DETAILS,
            self::MANAGE_DRAFTS,
        ];
    }
}
