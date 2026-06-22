import DiscordProvider from 'next-auth/providers/discord';
import { getDb } from '@/lib/communityDb';

export const authOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID ?? '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          scope: 'identify email guilds',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, user, profile }) {
      // Auto-register player in DB to capture global Discord name and avatar
      if (profile?.id) {
        try {
          const db = getDb();
          const existing = db.prepare('SELECT id FROM players WHERE discord_id = ?').get(profile.id);
          if (existing) {
            db.prepare('UPDATE players SET discord_name = ?, discord_avatar = ? WHERE discord_id = ?')
              .run(user.name || 'Unknown', user.image || null, profile.id);
          } else {
            // New users default to the 'Global' server (server_id = 1) if it exists
            db.prepare('INSERT INTO players (discord_id, discord_name, discord_avatar, server_id) VALUES (?, ?, ?, 1)')
              .run(profile.id, user.name || 'Unknown', user.image || null);
          }
        } catch (e) {
          console.error('Auto-registration error:', e);
        }
      }
      return true;
    },
    async jwt({ token, account, profile, user }) {
      if (account) {
        token.discordId = profile?.id;
        token.accessToken = account.access_token;

        const targetGuildId = process.env.DISCORD_GUILD_ID || '1231649939223707748';
        const adminRoleId = process.env.DISCORD_ADMIN_ROLE_ID || '';
        const botToken = process.env.DISCORD_BOT_TOKEN || '';

        try {
          // Check guild membership via user token
          const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${account.access_token}` },
          });
          if (guildsRes.ok) {
            const guilds = await guildsRes.json();
            token.isInGuild = guilds.some((g) => g.id === targetGuildId);
          } else {
            token.isInGuild = false;
          }
        } catch (e) {
          console.error('Discord Guild Check Error:', e);
          token.isInGuild = false;
        }

        const fallbackAdminIds = "1384330575573160078,1518565172824899676";
        const envAdminRoleId = adminRoleId || fallbackAdminIds;

        // Check admin role via Bot token
        token.isAdmin = false;
        if (profile?.id) {
          const adminIds = envAdminRoleId ? envAdminRoleId.split(',').map(i => i.trim()) : [];
          
          // 1. Direct User ID match (works even if Bot is offline/broken)
          // Always allow this specific user ID regardless of env variables!
          if (adminIds.includes(profile.id) || profile.id === '498521626988773386') {
            token.isAdmin = true;
          }  
          // 2. Role match (requires Bot)
          else if (botToken) {
            try {
              const cleanBotToken = botToken.replace(/^Bot\s+/i, '').trim();
              console.log(`[Auth] Intentando obtener roles del usuario ${profile.id} en el servidor ${targetGuildId}...`);
              
              const memberRes = await fetch(
                `https://discord.com/api/guilds/${targetGuildId}/members/${profile.id}`,
                { headers: { Authorization: `Bot ${cleanBotToken}` } }
              );
              
              console.log(`[Auth] Respuesta de Discord: ${memberRes.status} ${memberRes.statusText}`);
              
              if (memberRes.ok) {
                const member = await memberRes.json();
                console.log(`[Auth] Roles del usuario:`, member.roles);
                console.log(`[Auth] Roles de Admin requeridos en el .env:`, adminIds);
                
                if (Array.isArray(member.roles) && member.roles.some(r => adminIds.includes(r))) {
                  token.isAdmin = true;
                  console.log(`[Auth] ✅ Permiso de Admin concedido mediante rol!`);
                } else {
                  console.log(`[Auth] ❌ Permiso denegado: El usuario no tiene ninguno de los roles requeridos.`);
                }
              } else {
                const errorText = await memberRes.text();
                console.error(`[Auth] ❌ Error de la API de Discord:`, errorText);
              }
            } catch (e) {
              console.error('[Auth] ❌ Discord Admin Role Check Error:', e);
            }
          } else {
            console.log('[Auth] ❌ DISCORD_BOT_TOKEN no está configurado en el archivo .env');
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id        = token.sub;
        session.user.discordId = token.discordId;
        session.user.isInGuild = token.isInGuild ?? false;
        session.user.isAdmin   = token.isAdmin   ?? false;
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
