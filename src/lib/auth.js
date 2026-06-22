import DiscordProvider from 'next-auth/providers/discord';

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
    async signIn({ account, user }) {
      // Always allow sign in — guild check is done in jwt callback
      // Returning a URL string from signIn breaks the OAuth flow
      return true;
    },
    async jwt({ token, account, profile }) {
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
        const finalAdminRoleId = adminRoleId || fallbackAdminIds;

        // Check admin role via Bot token
        token.isAdmin = false;
        if (profile?.id) {
          const adminIds = finalAdminRoleId ? finalAdminRoleId.split(',').map(i => i.trim()) : [];
          
          // 1. Direct User ID match (works even if Bot is offline/broken)
          if (adminIds.includes(profile.id)) {
            token.isAdmin = true;
          } 
          // 2. Role match (requires Bot)
          else if (botToken) {
            try {
              const cleanBotToken = botToken.replace(/^Bot\s+/i, '').trim();
              const memberRes = await fetch(
                `https://discord.com/api/guilds/${targetGuildId}/members/${profile.id}`,
                { headers: { Authorization: `Bot ${cleanBotToken}` } }
              );
              if (memberRes.ok) {
                const member = await memberRes.json();
                if (Array.isArray(member.roles) && member.roles.some(r => adminIds.includes(r))) {
                  token.isAdmin = true;
                }
              }
            } catch (e) {
              console.error('Discord Admin Role Check Error:', e);
            }
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
