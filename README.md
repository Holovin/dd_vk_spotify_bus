# Как запустить?
1. Нужно: Node v14 (наверняка работает и на LTS, но не проверялось)
1. Создать `config.json` в корне (пример файла ниже) 
1. Доставить пакеты: `npm i` 
1. Запустить `npm run go` и смотреть на консоль (первые запуски будет авторизация и получение токенов)

## config.json
### Для Spotify
1. Создать приложение тут https://developer.spotify.com/dashboard/applications
1. В `Redirect URIs` указать `https://spotify.com`
1. Скопировать `Client ID` и `Client Secret` из Dashboard

### Пример файла
* vk:token - access_token из vk:URL (в консоли предложит перейти по ссылке) 
* vk:url — менять не нужно, используется id клиента VK Admin для получения доступов к своей музыке
* spotify:url — в ссылку добавить ваш client_id: `https://accounts.spotify.com/authorize?response_type=code&client_id=YOURS_CLIENT_ID&scope=playlist-read-collaborative%20playlist-modify-public%20playlist-read-private%20playlist-modify-private%20user-library-modify%20user-library-read&redirect_uri=https://spotify.com&state=ABCDEFGHIJKLMNOP`, state не используетеся, права запрашиваются максимальные для работы с аудио, остальные не нужны
* spotify:code - заполняется руками из URL после перехода по ссылке spotify:url
* spotify:expires_time - заполняется автоматически, хранит состояние токена (время его жизни у Spotify всего час)
* spotify:access_token - заполнится автоматически после логина
* spotify:refresh_token - заполнится автоматически после логина
* last_run - дебаг поле (время последнего запуска)
```
{
  "vk": {
    "token": "",
    "url": "https://oauth.vk.com/authorize?client_id=6146827&scope=audio&redirect_uri=https://oauth.vk.com/blank.html&display=page&response_type=token&revoke=1",
  },
  "spotify": {
    "url": "https://accounts.spotify.com/authorize?response_type=code&client_id=YOURS_CLIENT_ID&scope=playlist-read-collaborative%20playlist-modify-public%20playlist-read-private%20playlist-modify-private%20user-library-modify%20user-library-read&redirect_uri=https://spotify.com&state=ABCDEFGHIJKLMNOP",
    "code": "",
    "redirect_url": "https://spotify.com",
    "client_id": "",
    "client_secret": "",
    "state": "ABCDEFGHIJKLMNOP",
    "expires_time": 0,
    "access_token": "",
    "refresh_token": ""
  },
  "last_run": 0
}
```
