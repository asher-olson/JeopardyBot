import requests
from bs4 import BeautifulSoup

def scrape():
    lines = []

    for i in range(884):
        url = f"https://j-archive.com/showgame.php?game_id={7294 - i}"
        print(i)
        content = requests.get(url).content
        soup = BeautifulSoup(content, "html.parser")

        clues = soup.find_all("td", class_="clue")

        rounds = soup.find_all("table", class_="round")
        
        for doub, round in enumerate(rounds):
            categories = list(map(lambda x: x.text, round.find_all("td", class_="category_name")))
            
            rows = round.find_all("tr", recursive=False)[1:]

            for row in rows:
                clues = row.find_all("td", class_="clue")

                for ind, clue in enumerate(clues):
                    # get clue text
                    try:
                        clue_text = clue.find("td", class_="clue_text").text
                    except AttributeError:
                        continue

                    # get answer
                    try:
                        answer_html = clue.find("td").find("div")['onmouseover']
                    except AttributeError:
                        continue
                    except KeyError:
                        continue
                    except TypeError:
                        continue

                    soup2 = BeautifulSoup(f"<html>{answer_html}</html>", "html.parser")
                    answer = soup2.find("em", class_="correct_response").text

                    # get and convert value
                    try:
                        value = int(clue.find("td", class_="clue_value").text.strip("$"))
                        if doub == 1:
                            value /= 2
                    except AttributeError:
                        continue

                    # print(f"col: {ind}\ncategory: {categories[ind]}\nclue text: {clue_text}\nanswer: {answer}")

                    lines.append(f"{categories[ind]}###{clue_text}###{answer}###{value}")
        # break

    with open("questions.txt", "w") as f:
        for line in lines:
            try:
                f.write(line + "\n")
            except UnicodeEncodeError:
                continue

scrape()
