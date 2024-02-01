let avatar = document.getElementById("avatar");
let list = document.getElementById("list");
let hidden = true;

avatar.addEventListener("click", () => 
{
    list.classList.toggle("hidden");
    list.classList.toggle("flex");
});

window.onclick = (e) => {
    if (e.srcElement.id != "avatar")
    {
        list.classList.add("hidden");
        list.classList.remove("flex");
    }
}
