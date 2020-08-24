CREATE TABLE `cases` (
  `id` int(11) NOT NULL,
  `action` varchar(10) NOT NULL,
  `extras` longtext NOT NULL,
  `message_id` varchar(20) NOT NULL,
  `moderator_id` varchar(20) NOT NULL,
  `reason` text NOT NULL,
  `screenshots` longtext NOT NULL,
  `user_ids` longtext NOT NULL,
  `timestamp` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `guild_id` varchar(20) NOT NULL,
  UNIQUE KEY `message_id_UNIQUE` (`message_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `giveaways` (
  `created_by` varchar(20) NOT NULL,
  `prize` text NOT NULL,
  `message_id` varchar(20) NOT NULL,
  `channel_id` varchar(20) NOT NULL,
  `start` datetime NOT NULL,
  `end` datetime NOT NULL,
  `winners` text,
  `message_requirement` int(11) DEFAULT NULL,
  `requirement` text,
  PRIMARY KEY (`message_id`),
  UNIQUE KEY `message_id_UNIQUE` (`message_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `level_roles` (
  `guild_id` varchar(20) NOT NULL,
  `level` int(11) NOT NULL,
  `role_id` varchar(20) NOT NULL,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `role_id_UNIQUE` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `levels` (
  `user_id` varchar(20) NOT NULL,
  `level` int(11) NOT NULL DEFAULT '0',
  `xp` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `id_UNIQUE` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `messages` (
  `id` varchar(20) NOT NULL,
  `channel_id` varchar(20) NOT NULL,
  `guild_id` varchar(20) NOT NULL,
  `user_id` varchar(20) NOT NULL,
  `sent_timestamp` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `message_id_UNIQUE` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `mutes` (
  `user_id` varchar(20) NOT NULL,
  `start` datetime NOT NULL,
  `end` datetime NOT NULL,
  `guild_id` varchar(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `partnership_channels` (
  `guild_id` varchar(20) NOT NULL,
  `channel_id` varchar(20) NOT NULL,
  `min_members` int(11) NOT NULL,
  `max_members` int(11) DEFAULT NULL,
  `points` int(11) NOT NULL,
  PRIMARY KEY (`channel_id`),
  UNIQUE KEY `channel_id_UNIQUE` (`channel_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `partnerships` (
  `user_id` varchar(20) NOT NULL,
  `timestamp` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `guild_id` varchar(20) NOT NULL,
  `guild_invite` varchar(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `points` (
  `user_id` varchar(20) NOT NULL,
  `amount` int(11) NOT NULL DEFAULT '1000',
  `vault` int(11) NOT NULL DEFAULT '0',
  `last_daily` datetime NOT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `user_id_UNIQUE` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `profiles` (
  `user_id` varchar(20) NOT NULL,
  `description` text NOT NULL,
  `reputation` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `user_id_UNIQUE` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `settings` (
  `id` varchar(20) NOT NULL,
  `access_level_roles` longtext NOT NULL,
  `file_permissions_role` varchar(20) NOT NULL,
  `general_channel` varchar(20) NOT NULL,
  `lockdown_channel` varchar(20) DEFAULT NULL,
  `mfa_moderation` int(11) NOT NULL,
  `partner_rewards_channel` varchar(20) NOT NULL,
  `punishment_channel` varchar(20) NOT NULL,
  `rules_channel` varchar(20) NOT NULL,
  `rules_message` varchar(20) DEFAULT NULL,
  `staff_commands_channel` varchar(20) NOT NULL,
  `staff_server_category` varchar(20) NOT NULL,
  `starboard_channel_id` varchar(20) DEFAULT NULL,
  `starboard_enabled` int(11) NOT NULL,
  `starboard_minimum` int(11) NOT NULL,
  `welcome_role` varchar(20) DEFAULT NULL,
  `audit_logs_webhook` text,
  `member_logs_webhook` text,
  `invite_logs_webhook` text,
  `joins_webhook` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `guild_id_UNIQUE` (`id`),
  UNIQUE KEY `file_permissions_role_UNIQUE` (`file_permissions_role`),
  UNIQUE KEY `general_channel_UNIQUE` (`general_channel`),
  UNIQUE KEY `punishment_channel_UNIQUE` (`punishment_channel`),
  UNIQUE KEY `rules_channel_UNIQUE` (`rules_channel`),
  UNIQUE KEY `staff_commands_channel_UNIQUE` (`staff_commands_channel`),
  UNIQUE KEY `staff_server_category_UNIQUE` (`staff_server_category`),
  UNIQUE KEY `partner_rewards_channel_UNIQUE` (`partner_rewards_channel`),
  UNIQUE KEY `lockdown_channel_UNIQUE` (`lockdown_channel`),
  UNIQUE KEY `welcome_role_UNIQUE` (`welcome_role`),
  UNIQUE KEY `rules_message_UNIQUE` (`rules_message`),
  UNIQUE KEY `starboard_channel_id_UNIQUE` (`starboard_channel_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `shop_items` (
  `guild_id` varchar(20) NOT NULL,
  `action` text NOT NULL,
  `item` text NOT NULL,
  `cost` int(11) NOT NULL,
  PRIMARY KEY (`guild_id`),
  UNIQUE KEY `guild_id_UNIQUE` (`guild_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `starboard` (
  `message_id` varchar(20) NOT NULL,
  `starboard_id` varchar(20) NOT NULL,
  `channel_id` varchar(20) NOT NULL,
  `stars` int(11) NOT NULL,
  `users` longtext NOT NULL,
  `guild_id` varchar(20) NOT NULL,
  `author_id` varchar(20) NOT NULL,
  `timestamp` datetime NOT NULL,
  PRIMARY KEY (`message_id`),
  UNIQUE KEY `message_id_UNIQUE` (`message_id`),
  UNIQUE KEY `starboard_id_UNIQUE` (`starboard_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `users` (
  `id` varchar(20) NOT NULL,
  `access_token` varchar(50) DEFAULT NULL,
  `refresh_token` varchar(50) DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `access_level` int(11) NOT NULL DEFAULT '0',
  `token_type` text,
  `scopes` longtext,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`),
  UNIQUE KEY `access_token_UNIQUE` (`access_token`),
  UNIQUE KEY `refresh_token_UNIQUE` (`refresh_token`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `warnings` (
  `case_id` int(11) NOT NULL,
  `moderator_id` varchar(20) NOT NULL,
  `user_id` varchar(20) NOT NULL,
  `reason` text NOT NULL,
  `timestamp` datetime NOT NULL,
  `guild_id` varchar(20) NOT NULL,
  `id` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;